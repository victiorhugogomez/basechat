const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { text2iso, iso2text, convertToDate, isAfternoon, isMorning, isValidDate, isFutureDate,formatHour } = require("../scripts/utils");
const { isDateAvailable, getNextAvailableSlot,getNextEventsByPhoneNumber,deleteAppointmentById } = require("../scripts/calendar");
const { formFlow } = require("./form.flow");
const fs = require('fs');
const path = require('path');

let response = "";

function loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    let config;
    console.log('Config............')
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

const confirmationFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Confirmas la fecha propuesta? Responde unicamente con *si* o *no*", { capture: true },
        async (ctx, ctxFn) => {
            if (ctx.body.toLowerCase().includes("si")) {
                return ctxFn.gotoFlow(formFlow)
            } else {
                await ctxFn.endFlow("Reseva cancelada. Vuelve a solicitar una reserva para elegir otra fecha.")
            }
        });

const firstavailabilityOld = addKeyword(EVENTS.ACTION)
.addAnswer("Revisando disponibilidad...",null,
    async (ctx, ctxFn) => {
        const nextdateAvailable = await getNextAvailableSlot(new Date);
        await ctxFn.flowDynamic("la cita mas proxima es en esta fecha y hora :");
        const year = nextdateAvailable.start.getFullYear();
        const month = String(nextdateAvailable.start.getMonth() + 1).padStart(2, '0'); 
        const day = String(nextdateAvailable.start.getDate()).padStart(2, '0');
        const hour = nextdateAvailable.start.getHours();
        const min = nextdateAvailable.start.getMinutes();
        const minutes= (min < 10 ? '0' : '') + min;
        const dateString = `${day}/${month}/${year} ${hour}:${minutes}`;
        await ctxFn.flowDynamic(dateString);
        await ctxFn.state.update({ date: nextdateAvailable.start });
        return ctxFn.gotoFlow(confirmationFlow);
    });
    


let horas=[];
let Hours="";

const firstavailability = addKeyword(EVENTS.ACTION)
.addAnswer("Revisando disponibilidad...",null,
    async (ctx, ctxFn) => {
        const config =  loadConfig();
        console.log('config: ',config)
        const horaInicial =config['rangeLimit']['startHour']
        const horaFinal =config['rangeLimit']['endHour']
    
        const hours = [];
        console.log('hour:  ',hours);
        console.log('horaInicial:  ',horaInicial);
        console.log('horaFinal:  ',horaFinal);
        for (let hour = horaInicial; hour < horaFinal; hour++) { 
            console.log('hour:  ',hour);
        hours.push(hour);
        }

        let message = "Elige una hora para empezar a buscar citas:\n";

        console.log('hours:  ',hours)
        hours.forEach((hour, index) => {
            const formattedHour = formatHour(hour)
            console.log('formattedHour:  ',formattedHour)
            // const formattedHour = hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
            message += `responde *${index + 1}* para buscar a partir de las ${formattedHour}\n`;
        });
        horas=hours;
        await ctxFn.state.update({ hours });
        return await ctxFn.flowDynamic(message , { capture: true });
    })
// .addAnswer(message)
.addAnswer("Esperando la selección de la hora...", { capture: true },
    async (ctx, ctxFn) => {
        const hourIndex= ctx.body;
        console.log('hourIndex:',hourIndex)
        console.log('ctxFn.state.get():',ctxFn.state.get())
        const  hours  = horas;
        console.log('hours:',hours)
        const hora = hours[hourIndex-1];

        let nextdateAvailable = await getNextAvailableSlot(new Date);
        
        while (((nextdateAvailable.start.getHours()*60)+nextdateAvailable.start.getMinutes()) < (hora*60) ) {
                       
            nextdateAvailable = await getNextAvailableSlot(nextdateAvailable.start);
        }
        await ctxFn.flowDynamic("la cita mas proxima es en esta fecha y hora :");
        const year = nextdateAvailable.start.getFullYear();
        const month = String(nextdateAvailable.start.getMonth() + 1).padStart(2, '0'); 
        const day = String(nextdateAvailable.start.getDate()).padStart(2, '0');
        const hour = nextdateAvailable.start.getHours();
        const min = nextdateAvailable.start.getMinutes();
        const minutes= (min < 10 ? '0' : '') + min;
        const dateString = `${day}/${month}/${year} ${hour}:${minutes}`;
        await ctxFn.flowDynamic(dateString);
        await ctxFn.state.update({ date: nextdateAvailable.start });
        return ctxFn.gotoFlow(confirmationFlow);
    });

let requestedDate = null; 

const specificDateFlow = addKeyword(EVENTS.ACTION)   
    .addAnswer("Por favor, escribe la fecha que deseas agendar en el formato *DD/MM/AAAA*, por ejemplo *01/02/2024*.", { capture: true },
        async (ctx, ctxFn) => {
            const dateInput = ctx.body.trim();
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
                return ctxFn.fallBack("La fecha proporcionada no es válida. Por favor, intenta nuevamente.");
            }

            requestedDate = convertToDate(dateInput);

            if (!isValidDate(requestedDate)) {
                return ctxFn.fallBack("La fecha proporcionada no es válida. Por favor, intenta nuevamente.");
            }

            if (!isFutureDate(requestedDate)) {
                return ctxFn.fallBack("La fecha proporcionada ya ha pasado. Por favor, ingresa una fecha futura.");
            }

            // Aquí replicamos la lógica para mostrar las horas disponibles
            const config = await loadConfig();
            const horaInicial = config['rangeLimit']['startHour'];
            const horaFinal = config['rangeLimit']['endHour'];

            const hours = [];
            for (let hour = horaInicial; hour < horaFinal; hour++) { 
                hours.push(hour);
            }

            let message = "Elige una hora para empezar a buscar citas:\n";
            hours.forEach((hour, index) => {
                const formattedHour = formatHour(hour);
                message += `responde *${index + 1}* para buscar a partir de las ${formattedHour}\n`;
            });

            // Guardamos las horas en el estado para usarlas después
            horas=hours;
            await ctxFn.state.update({ hours });
            return await ctxFn.flowDynamic(message, { capture: true });
        })
    .addAnswer("Esperando la selección de la hora...", { capture: true },
        async (ctx, ctxFn) => {
            // Recuperar las horas desde el estado
            // const { hours } = await ctxFn.state.get();
            const  hours  = horas;
            const hourIndex = parseInt(ctx.body.trim()) - 1;

            // Validar que el índice seleccionado sea válido
            if (isNaN(hourIndex) || hourIndex < 0 || hourIndex >= hours.length) {
                return ctxFn.fallBack("Por favor, selecciona una hora válida.");
            }

            const selectedHour = hours[hourIndex];
            requestedDate.setHours(selectedHour, 0, 0, 0);  // Ajustar la hora seleccionada en la fecha proporcionada

            let nextAvailable = await getNextAvailableSlot(requestedDate);

            // Continuar buscando el siguiente slot disponible si la hora es anterior
            while (((nextAvailable.start.getHours() * 60) + nextAvailable.start.getMinutes()) < (selectedHour * 60)) {
                nextAvailable = await getNextAvailableSlot(nextAvailable.start);
            }

            const year = nextAvailable.start.getFullYear();
            const month = String(nextAvailable.start.getMonth() + 1).padStart(2, '0');
            const day = String(nextAvailable.start.getDate()).padStart(2, '0');
            const hour = nextAvailable.start.getHours();
            const min = String(nextAvailable.start.getMinutes()).padStart(2, '0');
            const dateString = `${day}/${month}/${year} ${hour}:${min}`;

            await ctxFn.flowDynamic(`La cita más próxima es en esta fecha y hora: ${dateString}`);
            await ctxFn.state.update({ date: nextAvailable.start });

            return ctxFn.gotoFlow(confirmationFlow);
        });


        const deleteApointment = addKeyword(EVENTS.ACTION)
        .addAnswer("Buscando tus citas...", null, async (ctx, ctxFn) => {
            const phoneNumber = ctx.from.substring(3);  // Obtener el número de teléfono del contexto
            const events = await getNextEventsByPhoneNumber(phoneNumber, 10);  // Obtener las próximas 10 citas del usuario
    
            if (events.length === 0) {
                return ctxFn.endFlow("No tienes citas para eliminar.");
            }
    
            // Mostrar la lista de citas al usuario
            let responseText = "Estas son tus citas actuales:\n";
            events.forEach((event, index) => {
                const eventDate = event.start.dateTime || event.start.date;
                responseText += `${index + 1}. ${event.summary} - ${eventDate}\n`;
            });
    
            // Guardar los eventos en el estado
            await ctxFn.state.update({ events });
    
            await ctxFn.flowDynamic(responseText);
            return ctxFn.gotoFlow(confirmDeleteFlow);  // Redirigir al nuevo flujo para eliminar
        });

    const confirmDeleteFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Por favor, selecciona el número de la cita que quieres eliminar:", { capture: true }, async (ctx, ctxFn) => {
        const events = await ctxFn.state.get('events');
        const selectedIndex = parseInt(ctx.body) - 1;

        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= events.length) {
            return ctxFn.fallBack("Número inválido. Por favor, selecciona un número de cita válido.");
        }

        const selectedEvent = events[selectedIndex];
        await ctxFn.state.update({ selectedEvent });
        await ctxFn.flowDynamic(`¿Estás seguro de que quieres eliminar la cita: ${selectedEvent.summary}?`);
    })
    .addAnswer("Responde con *sí* o *no* para confirmar la eliminación:", { capture: true }, async (ctx, ctxFn) => {
        const confirmation = ctx.body.toLowerCase();
        const selectedEvent = await ctxFn.state.get('selectedEvent');

        if (confirmation === "sí" || confirmation === "si") {
            const result = await deleteAppointmentById(selectedEvent.id);
            if (result) {
                return ctxFn.endFlow("La cita ha sido eliminada exitosamente.");
            } else {
                return ctxFn.endFlow("Hubo un error al eliminar la cita. Inténtalo más tarde.");
            }
        } else {
            return ctxFn.endFlow("La eliminación de la cita ha sido cancelada.");
        }
    });

const dateFlow = addKeyword(EVENTS.ACTION)
        .addAnswer("Perfecto! por favor escribe un:")
        .addAnswer("*1* para agendar en la fecha mas proxima")
        .addAnswer("*2* para seleccionar una fecha especifica")
        .addAnswer("*3* para eliminar una cita", { capture: true },
            async (ctx,ctxFn)=> {
            if(!["1","2","3"].includes(ctx.body)){
                return ctxFn.fallBack("no es una respuesta valida");
            }
            if(ctx.body==="1"){
                return await ctxFn.gotoFlow(firstavailability)
            }
            if(ctx.body==="2"){
                return await ctxFn.gotoFlow(specificDateFlow);
            }
            if(ctx.body==="3"){
                return await ctxFn.gotoFlow(deleteApointment);
            }
        });

module.exports = { dateFlow, confirmationFlow, firstavailability, specificDateFlow, deleteApointment, confirmDeleteFlow };
