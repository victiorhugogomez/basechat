const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar una ruta para servir "Hola Mundo"

const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
const GooglePeopleAPI = require('./scripts/GooglePeopleAPI'); 
// const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')

app.use(express.json());  // Middleware para manejar JSON
app.use(express.static(path.join(__dirname, 'public')));  // Servir archivos estáticos desde la carpeta public

// Cargar los valores desde config.json al iniciar la aplicación
let config = {
    rangeLimit: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 },
    standardDuration: 0.25
};

if (fs.existsSync('./config.json')) {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
}
app.get('/bot-qr', (req, res) => {
    const qrPath = path.join(__dirname, 'bot.qr.png');  // Ubicación del archivo QR
    res.sendFile(qrPath);
});
app.get('/get-config', (req, res) => {
    const configPath = path.join(__dirname, 'config.json');
    try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configData);
        res.json(config);  // Enviar la configuración al frontend
    } catch (err) {
        console.error('Error al cargar el archivo config.json:', err);
        res.status(500).json({ error: 'No se pudo cargar config.json' });
    }
});
// Ruta para manejar la recepción de la configuración desde el formulario
app.post('/save-config', (req, res) => {
    try {
        const newConfig = req.body;

        console.log('Configuración recibida:', newConfig);

        // Convertir la duración de citas de minutos a horas
        newConfig.standardDuration = newConfig.standardDuration / 60;

        // Leer el archivo config.json existente
        const configPath = './config.json';
        let existingConfig = {};

        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            existingConfig = JSON.parse(configData);
        }

        // Fusionar la nueva configuración con la existente
        const updatedConfig = {
            ...existingConfig,  // Mantener los campos existentes
            rangeLimit: { 
                ...existingConfig.rangeLimit,  // Mantener el rango existente y sobreescribir solo días, horas, etc.
                ...newConfig.rangeLimit
            },
            standardDuration: newConfig.standardDuration
        };

        // Guardar la configuración fusionada en config.json
        fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

        // Actualizar la variable config en memoria
        config = updatedConfig;

        res.send('<h1>Configuración guardada con éxito</h1><a href="/">Volver</a>');
    } catch (err) {
        console.error('Error al procesar la solicitud:', err);
        res.status(500).send('Error al guardar la configuración');
    }
});

// --- Lógica del bot WhatsApp ---

const peopleAPI = new GooglePeopleAPI('../google.json', [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts'
]);


const { welcomeFlow } = require('./flows/welcome.flow.js');
const { formFlow } = require("./flows/form.flow.js")
const { dateFlow, confirmationFlow,firstavailability,specificDateFlow } = require("./flows/date.flow.js")
const { agregarUsuario, agregarCorreo, agregarContacto } = require("./flows/contacts.flow.js")
const { text2iso, iso2text,convertToDate,isAfternoon,isMorning,isValidDate,isFutureDate,validarCorreo,clientName } = require("./scripts/utils")
const { userMemory } = require('./scripts/userMemory.js');
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

    // Verificamos si el nombre ya está almacenado en memoria
    if (!userMemory[phoneNumber]) {
        // Verificamos si el contacto ya está registrado en Google Contacts
        const contact = await isContactInGoogleContacts(phoneNumber);

        if (!contact) {
            // Si el contacto no está registrado, lo enviamos al flujo de agregar usuario
            return ctxFn.gotoFlow(agregarUsuario);
        } else {
            // Si el contacto está registrado, guardamos su nombre en memoria
            userMemory[phoneNumber] = contact.nombre;
        }
    }

    // El nombre ya está en memoria o acaba de ser consultado
    const userName = userMemory[phoneNumber];
    
    // Flujos normales de respuestas, utilizando el nombre si es necesario
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
        return ctxFn.endFlow(`Hola ${userName}, soy un asistente virtual, no pude entender lo que quisiste decir. Escribe *hola* o *agendar* para entrar a un flujo en el que pueda apoyarte.`);
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
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    // QRPortalWeb()
}
app.listen(PORT, () => main());
// main()
