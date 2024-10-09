const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
const GooglePeopleAPI = require('./scripts/GooglePeopleAPI'); 
const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')

const peopleAPI = new GooglePeopleAPI('../google.json', [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts'
]);


const { welcomeFlow } = require('./flows/welcome.flow.js');
const { formFlow } = require("./flows/form.flow.js")
const { dateFlow, confirmationFlow,firstavailability,specificDateFlow } = require("./flows/date.flow.js")
const { agregarUsuario, agregarCorreo, agregarContacto } = require("./flows/contacts.flow.js")
const { text2iso, iso2text,convertToDate,isAfternoon,isMorning,isValidDate,isFutureDate,validarCorreo,clientName } = require("./scripts/utils")
// Función para verificar si el contacto ya está registrado
async function isContactInGoogleContacts(phoneNumber) {
    try {
        const contacts = await peopleAPI.listContacts();
        console.log('contacts: ', contacts)
        console.log('phonenumber: ', phoneNumber);
        const contactList = contacts || [];
        const contact = contactList.find(contact => {
            return contact.telefono && contact.telefono === phoneNumber;            
        });
        return contact ? contact : null;
    } catch (error) {
        console.error('Error al verificar si el contacto existe:', error);
        return null;
    }
}

const flowPrincipal = addKeyword(EVENTS.WELCOME)
.addAction(async (ctx, ctxFn) => {
    const phoneNumber = ctx.from.substring(3);  // Número de teléfono del usuario

    // Verificamos si el contacto ya está registrado
    const contact = await isContactInGoogleContacts(phoneNumber);

    if (!contact) { 
        return ctxFn.gotoFlow(agregarUsuario);        

    } else {
        // Si el contacto está registrado, sigue el flujo normal de respuestas
        const bodyText = ctx.body.toLowerCase();
        const keywords = ["hola", "buenas", "ola"];
        const containsKeyword = keywords.some(keyword => bodyText.includes(keyword));

        if (containsKeyword && ctx.body.length < 8) {
            return await ctxFn.gotoFlow(welcomeFlow);  // Redirige al flujo de bienvenida (simple saludo)
        }

        const keywordsDate = ["agendar", "cita", "reunion", "turno"];
        const containsKeywordDate = keywordsDate.some(keyword => bodyText.includes(keyword));

        if (containsKeywordDate) {
            return ctxFn.gotoFlow(dateFlow);  // Si el usuario quiere agendar una cita
        } else {
            return ctxFn.endFlow("Hola soy un asistente virtual, no pude entender lo que quisiste decir, para poderte ayudar por favor escribe *hola* o *agendar* para entrar a un flujo en el que pueda apoyarte");
        }
    }
});



const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowPrincipal, welcomeFlow, formFlow, dateFlow, confirmationFlow,firstavailability,specificDateFlow,agregarUsuario, agregarCorreo,agregarContacto])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    QRPortalWeb()
}

main()
