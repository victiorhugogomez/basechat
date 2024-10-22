const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { createEvent } = require("../scripts/calendar")

const formFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Excelente! Gracias por confimar la fecha. Te voy a hacer unas consultas para agendar el turno. Primero ¿A que nombre quedaria la cita?", { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ name: ctx.body }); // Guarda el nombre del usuario en el estado
        }
    )
    .addAnswer("Perfecto, ¿Cual es el motivo del turno?", { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ motive: ctx.body }); // Guarda el motivo en el estado
            const userInfo = await ctxFn.state.getMyState();
                const phoneNumber = ctx.from.substring(3);
                const eventName = userInfo.name;
                const description = `${userInfo.motive} - Teléfono: ${phoneNumber}`;
                const date = userInfo.date; 
                console.log('user Info///////////////', userInfo)  
                if (!(date instanceof Date)) {
                    // Intentar convertir el valor de 'date' a un objeto Date
                    date = new Date(date);
                }
        
                // Validar si la fecha es válida
                if (isNaN(date.getTime())) {
                    // Si la fecha no es válida, finalizar el flujo con un mensaje de error
                    return ctxFn.endFlow("Error: La fecha proporcionada no es válida.");
                }      
                const eventId = await createEvent(eventName, description, date,null, phoneNumber);
                await ctxFn.state.clear();
                return ctxFn.gotoFlow(confirmation)
        }
    )
    const confirmation = addKeyword(EVENTS.ACTION)
    .addAnswer("Excelente! Ya cree la reunión. Te esperamos!")

module.exports = { formFlow,confirmation };
