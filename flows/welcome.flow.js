const { addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const { text2iso, iso2text,convertToDate,isAfternoon,isMorning,isValidDate,isFutureDate,validarCorreo,clientName } = require("../scripts/utils")
const { userMemory } = require('../scripts/userMemory.js');
const welcomeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, ctxFn) => {
        const phoneNumber = ctx.from.substring(3);  // Número de teléfono del usuario
        const userName = userMemory[phoneNumber] || 'Usuario';  // Recuperar el nombre si está disponible

        await ctxFn.endFlow(`Bienvenid@ ${userName}! Puedes escribir 'Agendar cita' para reservar una cita.`);
    })

module.exports = { welcomeFlow };