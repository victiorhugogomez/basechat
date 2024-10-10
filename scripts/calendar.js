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

        // Verificar que todos los valores requeridos estén presentes
        const requiredFields = ['rangeLimit', 'standardDuration', 'timeZone', 'calendarID', 'dateLimit'];
        requiredFields.forEach(field => {
            if (!config[field]) {
                throw new Error(`Falta el valor requerido: ${field} en config.json`);
            }
        });

        // Verificar que rangeLimit tenga las claves necesarias
        if (!config.rangeLimit.days || !config.rangeLimit.startHour || !config.rangeLimit.endHour) {
            throw new Error('Faltan valores en rangeLimit en config.json');
        }
    } catch (err) {
        console.error('Error al cargar el archivo config.json:', err);

        // Configuración por defecto si no se puede cargar el archivo o si faltan valores
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
 * @param {string} eventName - Nombre del evento.
 * @param {string} description - Descripción del evento.
 * @param {string} date - Fecha y hora de inicio del evento en formato ISO (e.g., '2024-06-01T10:00:00-07:00').
 * @param {number} [duration] - Duración del evento en horas. Default es 1 hora.
 * @returns {string} - URL de la invitación al evento.
 */
async function createEvent(eventName, description, date, duration) {
    const { calendarID, timeZone, standardDuration } = loadConfig();
    duration = duration || standardDuration;

    try {
        // Autenticación
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        // Fecha y hora de inicio del evento
        const startDateTime = new Date(date);
        // Fecha y hora de fin del evento
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(startDateTime.getMinutes() + (duration * 60));

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
            colorId: '2' // El ID del color verde en Google Calendar es '11'
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

/**
 * Lista los slots disponibles entre las fechas dadas.
 * @param {Date} [startDate=new Date()] - Fecha de inicio para buscar slots disponibles. Default es la fecha actual.
 * @param {Date} [endDate] - Fecha de fin para buscar slots disponibles. Default es el máximo definido por dateLimit.
 * @returns {Array} - Lista de slots disponibles.
 */
async function listAvailableSlots(startDate = new Date(), endDate) {
    const { calendarID, timeZone, rangeLimit, standardDuration, dateLimit } = loadConfig();
    console.log('valores//////////////////////////////////////////////////')
    console.log(calendarID)
    console.log(timeZone)
    console.log(rangeLimit)
    console.log(standardDuration)
    console.log(dateLimit)
// console.log()
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });
        console.log('endDate',endDate)
        console.log('dateLimit',dateLimit)
        // Definir fecha de fin si no se proporciona de todo el rango de fechas en este caso se usa el maximo de dias 
        if (!endDate) {
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + dateLimit);
            console.log('date limit', dateLimit)
            console.log(' start date ',startDate)
            console.log('end date', endDate)
        }
        // se obtiene la lista de eventos de el calendario 
        const response = await calendar.events.list({
            calendarId: calendarID,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            timeZone: timeZone,
            singleEvents: true,
            orderBy: 'startTime'
        });

        // se iguala el arreglo de eventos a la constante events
        const events = response.data.items || [{algo:"algo 1"},{algo:"algo 2"}];
        console.log('response data///////////////////// ', response.data)
        console.log('events///////////////////// ', events)
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
 * @param {Date} date - Fecha a verificar.
 * @returns {boolean} - Devuelve true si hay slots disponibles dentro del rango permitido, false en caso contrario.
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
 * @param {string|Date} date - Fecha a partir de la cual buscar el próximo slot disponible, puede ser un string en formato ISO o un objeto Date.
 * @returns {Object|null} - El próximo slot disponible o null si no hay ninguno.
 */
async function getNextAvailableSlot(date) {
    try {
        if (typeof date === 'string') {
            date = new Date(date);
        } else if (!(date instanceof Date) || isNaN(date)) {
            throw new Error('La fecha proporcionada no es válida.');
        }
        
        
        // Obtener el próximo slot disponible

        // Obtener el próximo slot disponible
        const availableSlots = await listAvailableSlots(date);
        const filteredSlots = availableSlots.filter(slot => new Date(slot.start) > date);
        const sortedSlots = filteredSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

        return sortedSlots.length > 0 ? sortedSlots[0] : null;
    } catch (err) {
        console.error('Hubo un error al obtener el próximo slot disponible: ' + err);
        throw err;
    }
}

module.exports = { createEvent, isDateAvailable, getNextAvailableSlot };
