const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Función para cargar la configuración desde config.json en cada operación
function loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    let config;
    
    try {
        const configData = fs.readFileSync(configPath, 'utf-8');  // Leer el archivo JSON
        config = JSON.parse(configData);  // Convertir el JSON a objeto

        const requiredFields = ['rangeLimit', 'standardDuration', 'timeZone', 'calendarID', 'dateLimit'];
        requiredFields.forEach(field => {
            if (!config[field]) {
                throw new Error(`Falta el valor requerido: ${field} en config.json`);
            }
        });

        if (!config.rangeLimit.days || !config.rangeLimit.startHour || !config.rangeLimit.endHour) {
            throw new Error('Faltan valores en rangeLimit en config.json');
        }
    } catch (err) {
        console.error('Error al cargar el archivo config.json:', err);

        config = {
            rangeLimit: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 },
            standardDuration: 0.25,
            timeZone: 'America/Mexico_City',
            calendarID: '447290a939b1187df79c01c644393dfcfc343a77cb5361acb359af631447002c@group.calendar.google.com',
            dateLimit: 10
        };
        console.log('Usando configuración por defecto:', config);
    }

    return config;
}

// Inicializa la librería cliente de Google y configura la autenticación con credenciales de la cuenta de servicio.
const auth = new google.auth.GoogleAuth({
    keyFile: './google.json',  // Ruta al archivo de clave de tu cuenta de servicio.
    scopes: ['https://www.googleapis.com/auth/calendar']  // Alcance para la API de Google Calendar.
});

const calendar = google.calendar({ version: "v3" });

/**
 * Crea un evento en el calendario.
 */
async function createEvent(eventName, description, date, duration,phoneNumber) {
    const { calendarID, timeZone, standardDuration } = loadConfig();
    duration = duration || standardDuration;

    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });
        console.log('date/////////',date)
        const startDateTime = new Date(date);
        console.log('startDateTime/////////',startDateTime)
        const endDateTime = new Date(startDateTime);
        console.log('startDateTime.getMinutes()/////////',startDateTime.getMinutes())
        console.log('duration/////////',duration)
        endDateTime.setMinutes(startDateTime.getMinutes() + (duration * 60));
        console.log('endDateTime/////////',endDateTime)
        const event = {
            summary: eventName,
            description: description,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: timeZone,
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: timeZone,
            },
            colorId: '2',
            extendedProperties: {
                private: {
                    phoneNumber: phoneNumber  // Guardar el número de teléfono del usuario
                }
            }
        };

        const response = await calendar.events.insert({
            calendarId: calendarID,
            resource: event,
        });

        const eventId = response.data.id;
        console.log('Evento creado con éxito');
        return eventId;
    } catch (err) {
        console.error('Hubo un error al crear el evento en el servicio de Calendar:', err);
        throw err;
    }
}

// Función para obtener los próximos eventos
async function getNextEvents(dateLimit) {
    const { calendarID, timeZone } = loadConfig();
    dateLimit = dateLimit || loadConfig().dateLimit;

    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + dateLimit);

        const response = await calendar.events.list({
            calendarId: calendarID,
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            timeZone: timeZone,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items;
        return events || [];
    } catch (err) {
        console.error('Hubo un error al contactar el servicio de Calendar: ' + err);
        throw err;
    }
}

async function getNextEventsByPhoneNumber(phoneNumber, dateLimit) {
    const { calendarID, timeZone } = loadConfig();
    dateLimit = dateLimit || loadConfig().dateLimit;

    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + dateLimit);

        const response = await calendar.events.list({
            calendarId: calendarID,
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            timeZone: timeZone,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items || [];

        // Filtrar eventos que tienen el número de teléfono en las propiedades extendidas privadas
        const userEvents = events.filter(event => 
            event.extendedProperties && 
            event.extendedProperties.private && 
            event.extendedProperties.private.phoneNumber === phoneNumber
        );

        return userEvents;
    } catch (err) {
        console.error('Hubo un error al contactar el servicio de Calendar para el número de teléfono:', phoneNumber, 'Error:', err);
        throw err;
    }
}


/**
 * Lista los slots disponibles entre las fechas dadas.
 */
async function listAvailableSlots(startDate = new Date(), endDate) {
    const { calendarID, timeZone, rangeLimit, standardDuration, dateLimit } = loadConfig();
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        if (!endDate) {
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + dateLimit);
        }

        const response = await calendar.events.list({
            calendarId: calendarID,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            timeZone: timeZone,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items || [];
        const slots = [];
        let currentDate = new Date(startDate);

        while (currentDate < endDate) {
            const dayOfWeek = currentDate.getDay();
            if (rangeLimit.days.includes(dayOfWeek)) {
                for (let hour = rangeLimit.startHour; hour < rangeLimit.endHour; hour++) {
                    for (let minute = 0; minute < 60; minute += standardDuration * 60) { // Incrementar cada 30 minutos
                        const slotStart = new Date(currentDate);
                        slotStart.setHours(hour, minute, 0, 0);
                        const slotEnd = new Date(slotStart);
                        slotEnd.setMinutes(slotStart.getMinutes() + standardDuration * 60);

                        const isBusy = events.some(event => {
                            const eventStart = new Date(event.start.dateTime || event.start.date);
                            const eventEnd = new Date(event.end.dateTime || event.end.date);
                            return (slotStart < eventEnd && slotEnd > eventStart);
                        });

                        if (!isBusy) {
                            slots.push({ start: slotStart, end: slotEnd });
                        }
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return slots;
    } catch (err) {
        console.error('Hubo un error al contactar el servicio de Calendar: ' + err);
        throw err;
    }
}

/**
 * Verifica si hay slots disponibles para una fecha dada.
 */
async function isDateAvailable(date) {
    const { rangeLimit, standardDuration, dateLimit } = loadConfig();
    try {
        const currentDate = new Date();
        const maxDate = new Date(currentDate);
        maxDate.setDate(currentDate.getDate() + dateLimit);

        if (date < currentDate || date > maxDate) {
            return false;
        }

        const dayOfWeek = date.getDay();
        if (!rangeLimit.days.includes(dayOfWeek)) {
            return false;
        }

        const hour = date.getHours();
        if (hour < rangeLimit.startHour || hour >= rangeLimit.endHour) {
            return false;
        }

        const availableSlots = await listAvailableSlots(currentDate);
        const slotsOnGivenDate = availableSlots.filter(slot => new Date(slot.start).toDateString() === date.toDateString());

        return slotsOnGivenDate.some(slot =>
            new Date(slot.start).getTime() === date.getTime() &&
            new Date(slot.end).getTime() === date.getTime() + (standardDuration * 60 * 60 * 1000)
        );
    } catch (err) {
        console.error('Hubo un error al verificar disponibilidad de la fecha: ' + err);
        throw err;
    }
}

/**
 * Obtiene el próximo slot disponible a partir de la fecha dada.
 */
async function getNextAvailableSlot(date) {
    try {
        if (typeof date === 'string') {
            date = new Date(date);
        } else if (!(date instanceof Date) || isNaN(date)) {
            throw new Error('La fecha proporcionada no es válida.');
        }
        
        const availableSlots = await listAvailableSlots(date);
        const filteredSlots = availableSlots.filter(slot => new Date(slot.start) > date);
        const sortedSlots = filteredSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

        return sortedSlots.length > 0 ? sortedSlots[0] : null;
    } catch (err) {
        console.error('Hubo un error al obtener el próximo slot disponible: ' + err);
        throw err;
    }
}
async function deleteAppointmentById(eventId) {
    const { calendarID } = loadConfig();  // Cargar la configuración con el ID del calendario

    try {
        const authClient = await auth.getClient();  // Autenticación
        google.options({ auth: authClient });

        // Llamada a la API de Google Calendar para eliminar el evento
        await calendar.events.delete({
            calendarId: calendarID,
            eventId: eventId
        });

        console.log(`Evento con ID ${eventId} eliminado con éxito.`);
        return true;
    } catch (err) {
        console.error(`Hubo un error al eliminar el evento con ID ${eventId}:`, err);
        return false;
    }
}

module.exports = { createEvent, isDateAvailable, getNextAvailableSlot, getNextEventsByPhoneNumber,deleteAppointmentById };
