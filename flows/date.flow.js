const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { text2iso, iso2text, convertToDate, isAfternoon, isMorning, isValidDate, isFutureDate } = require("../scripts/utils");
const { isDateAvailable, getNextAvailableSlot,getNextEventsByPhoneNumber,deleteAppointmentById } = require("../scripts/calendar");
const { formFlow } = require("./form.flow");

let response = "";

const confirmationFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Confirmas la fecha propuesta? Responde unicamente con *si* o *no*", { capture: true },
        async (ctx, ctxFn) => {
            if (ctx.body.toLowerCase().includes("si")) {
                return ctxFn.gotoFlow(formFlow)
            } else {
                await ctxFn.endFlow("Reseva cancelada. Vuelve a solicitar una reserva para elegir otra fecha.")
            }
        });

const firstavailability = addKeyword(EVENTS.ACTION)
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

            return ctxFn.flowDynamic("¿Prefieres la cita por la *mañana* o por la *tarde*? Responde con *mañana* o *tarde*.");
        })
    .addAnswer("Esperando la respuesta de mañana o tarde...", { capture: true },
        async (ctx, ctxFn) => {
            const preference = ctx.body.toLowerCase();
            if (preference !== "mañana" && preference !== "tarde") {
                return ctxFn.fallBack("Por favor, responde con *mañana* o *tarde*.");
            }

            if (!requestedDate || !isValidDate(requestedDate)) {
                return ctxFn.fallBack("Ha ocurrido un error con la fecha. Por favor, vuelve a ingresar la fecha.");
            }

            const isPreferredTime = preference === "mañana" ? isMorning : isAfternoon;

            let nextAvailable = await getNextAvailableSlot(requestedDate);

            while (!isPreferredTime(nextAvailable.start)) {
                nextAvailable = await getNextAvailableSlot(nextAvailable.start);
            }

            const year = nextAvailable.start.getFullYear();
            const month = String(nextAvailable.start.getMonth() + 1).padStart(2, '0');
            const day = String(nextAvailable.start.getDate()).padStart(2, '0');
            const hour = nextAvailable.start.getHours();
            const min = String(nextAvailable.start.getMinutes()).padStart(2, '0');
            const dateString = `${day}/${month}/${year} ${hour}:${min}`;

            await ctxFn.flowDynamic(`La primera cita disponible por la ${preference} es: ${dateString}`);
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
