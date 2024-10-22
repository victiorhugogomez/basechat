const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { text2iso, iso2text, convertToDate, isAfternoon, isMorning, isValidDate, isFutureDate, validarCorreo, randomWait, clientName } = require("../scripts/utils");
const { formFlow } = require("./form.flow");
const { welcomeFlow } = require("./welcome.flow");
const { userMemory } = require('../scripts/userMemory.js');
const GooglePeopleAPI = require('../scripts/GooglePeopleAPI'); 

let nombre = '';
let correo = '';
let telefono = '';

const peopleAPI = new GooglePeopleAPI('../google.json', [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts'
]);

const agregarTelefono = addKeyword(EVENTS.ACTION);

const agregarCorreo = addKeyword(EVENTS.ACTION)
    .addAnswer("Ingresa tu correo opcional, si no quieres registrar un correo solo escribe *1*, de lo contrario escribe tu correo por favor:", { capture: true },
        async (ctx, ctxFn) => {
            await randomWait();  // Espera aleatoria antes de responder
            if (ctx.body === "1") {
                return await ctxFn.gotoFlow(agregarContacto);
            } else {
                if (validarCorreo(ctx.body)) {
                    correo = ctx.body;
                    return await ctxFn.gotoFlow(agregarContacto);
                } else {
                    return ctxFn.fallBack("El correo no es válido");
                }
            }
        }
    );

const confirmarNombreFlow = addKeyword(EVENTS.ACTION)
    .addAnswer(`El nombre que has ingresado es: *${nombre}*. ¿Es correcto? Responde con 'sí' o 'no'.`, { capture: true },
        async (ctx, ctxFn) => {
            await randomWait();
            if (ctx.body.toLowerCase() === "sí" || ctx.body.toLowerCase() === "si") {
                return await ctxFn.gotoFlow(agregarCorreo);
            } else {
                return ctxFn.fallBack("Por favor, ingresa tu nombre nuevamente.");
            }
        }
    );
      
      

const agregarContacto = addKeyword(EVENTS.ACTION)
    .addAnswer("Guardando contacto...", null,
        async (ctx, ctxFn) => {
            await randomWait();
            try {
        // Registramos al nuevo contacto en Google Contacts
         const newContact = await peopleAPI.createContact(nombre, correo, telefono);
        await ctxFn.flowDynamic(`¡Gracias, ${nombre}! Has sido registrado correctamente.`);
        userMemory[telefono] = nombre;
    
        // Luego, lo redirigimos al flujo de bienvenida (simple saludo)
        return await ctxFn.gotoFlow(welcomeFlow);
        } catch (error) {
        await ctxFn.endFlow(`Hubo un error al registrar tu contacto. Por favor, intenta más tarde.`);
        console.error('Error al agregar el contacto:', error);
        }
        }
    );

const agregarUsuario = addKeyword(EVENTS.ACTION)
    .addAnswer("Parece que no estás registrado. Vamos a agregar tu información.\nPor favor, ingresa tu nombre:", { capture: true },
        async (ctx, ctxFn) => {
            await randomWait();
            telefono = ctx.from.substring(3);
            nombre = ctx.body;
            return await ctxFn.gotoFlow(confirmarNombreFlow);
        }
    );

module.exports = { agregarUsuario, agregarCorreo, agregarContacto };
