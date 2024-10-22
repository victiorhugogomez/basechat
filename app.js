const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const GooglePeopleAPI = require('./scripts/GooglePeopleAPI');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const configPath = path.join(__dirname, 'config.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let config = {
    rangeLimit: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 },
    standardDuration: 0.25,
    storeContacts: true
};

if (fs.existsSync('./config.json')) {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
}

app.get('/bot-qr', (req, res) => {
    const qrPath = path.join(__dirname, 'bot.qr.png');
    res.sendFile(qrPath);
});

app.get('/get-config', (req, res) => {
    const configPath = path.join(__dirname, 'config.json');
    try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configData);
        res.json(config);
    } catch (err) {
        console.error('Error al cargar el archivo config.json:', err);
        res.status(500).json({ error: 'No se pudo cargar config.json' });
    }
});

app.post('/save-config', (req, res) => {
    try {
        const newConfig = req.body;
        newConfig.standardDuration = newConfig.standardDuration / 60;

        const configPath = './config.json';
        let existingConfig = {};

        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            existingConfig = JSON.parse(configData);
        }

        const updatedConfig = {
            ...existingConfig,
            rangeLimit: { 
                ...existingConfig.rangeLimit,
                ...newConfig.rangeLimit
            },
            standardDuration: newConfig.standardDuration,
            storeContacts: newConfig.storeContacts
        };

        fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

        config = updatedConfig;
        res.send('<h1>Configuración guardada con éxito</h1><a href="/">Volver</a>');
    } catch (err) {
        console.error('Error al procesar la solicitud:', err);
        res.status(500).send('Error al guardar la configuración');
    }
});

// Nueva ruta para exportar contactos a CSV
app.get('/export-contacts', async (req, res) => {
    try {
        const peopleAPI = new GooglePeopleAPI('../google.json', [
            'https://www.googleapis.com/auth/contacts.readonly',
            'https://www.googleapis.com/auth/contacts'
        ]);
        const contacts = await peopleAPI.listContacts();
        const csvRows = ['Nombre,Correo,Teléfono'];
        contacts.forEach(contact => {
            csvRows.push(`${contact.nombre},${contact.email},${contact.telefono}`);
        });
        const csvData = csvRows.join('\n');
        res.header('Content-Type', 'text/csv');
        res.attachment('contacts.csv');
        res.send(csvData);
    } catch (err) {
        console.error('Error al exportar contactos:', err);
        res.status(500).send('Error al exportar contactos');
    }
});

const peopleAPI = new GooglePeopleAPI('../google.json', [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts'
]);

const { welcomeFlow } = require('./flows/welcome.flow.js');
const { formFlow,confirmation } = require("./flows/form.flow.js");
const { dateFlow, confirmationFlow, firstavailability, specificDateFlow,deleteApointment,confirmDeleteFlow } = require("./flows/date.flow.js");
const { agregarUsuario, agregarCorreo, agregarContacto } = require("./flows/contacts.flow.js");
const { text2iso, iso2text, convertToDate, isAfternoon, isMorning, isValidDate, isFutureDate, validarCorreo,randomWait } = require("./scripts/utils");
const { userMemory } = require('./scripts/userMemory.js');

async function isContactInGoogleContacts(phoneNumber) {
    try {
        const contacts = await peopleAPI.listContacts();
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
        await randomWait();
        let config;
        const phoneNumber = ctx.from.substring(3);
        const configData = fs.readFileSync(configPath, 'utf-8');  // Leer el archivo JSON
        config = JSON.parse(configData);

        if (config['storeContacts']) {
            if (!userMemory[phoneNumber]) {
                const contact = await isContactInGoogleContacts(phoneNumber);
                if (!contact) {
                    return ctxFn.gotoFlow(agregarUsuario);
                } else {
                    userMemory[phoneNumber] = contact.nombre;
                }
            }
        }


        const userName = userMemory[phoneNumber];
        const bodyText = ctx.body.toLowerCase();
        const keywords = ["hola", "buenas", "ola"];
        const containsKeyword = keywords.some(keyword => bodyText.includes(keyword));

        if (containsKeyword && ctx.body.length < 8) {
            return await ctxFn.gotoFlow(welcomeFlow);
        }

        const keywordsDate = [ "citas","cita", "reunion", "turno"];
        const containsKeywordDate = keywordsDate.some(keyword => bodyText.includes(keyword));

        if (containsKeywordDate) {
            return ctxFn.gotoFlow(dateFlow);
        } else {
            return ctxFn.endFlow(`Hola ${userName}, soy un asistente virtual, no pude entender lo que quisiste decir. Escribe *hola* o *agendar* para entrar a un flujo en el que pueda apoyarte.`);
        }
    });

const main = async () => {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowPrincipal, welcomeFlow, formFlow, confirmation, dateFlow, confirmationFlow, firstavailability, specificDateFlow, deleteApointment, confirmDeleteFlow, agregarUsuario, agregarCorreo, agregarContacto]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    console.log(`Servidor corriendo en http://localhost:${PORT}`);
};

app.listen(PORT, () => main());
