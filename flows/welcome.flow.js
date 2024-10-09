const { addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const { text2iso, iso2text,convertToDate,isAfternoon,isMorning,isValidDate,isFutureDate,validarCorreo,clientName } = require("../scripts/utils")

const welcomeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, ctxFn) => {
        await ctxFn.endFlow("Bienvenido a este chatbot! \nPodes escribir 'Agendar cita' para reservar una cita")
    })

module.exports = { welcomeFlow };