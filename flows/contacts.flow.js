const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { text2iso, iso2text,convertToDate,isAfternoon,isMorning,isValidDate,isFutureDate,validarCorreo,clientName } = require("../scripts/utils")
const { formFlow } = require("./form.flow")
const {welcomeFlow}= require ("./welcome.flow")
const GooglePeopleAPI = require('../scripts/GooglePeopleAPI'); 
let nombre=''
let correo=''
let telefono=''

const peopleAPI = new GooglePeopleAPI('../google.json', [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts'
]);

const agregarTelefono = addKeyword(EVENTS.ACTION)

const agregarCorreo = addKeyword(EVENTS.ACTION)
.addAnswer("ingresa tu correo opcional, si no quieres registrar un correo solo escribe *1* de lo contrario escribe tu correo por favor:", { capture: true },
    async (ctx,ctxFn)=>{
        if(ctx.body==="1"){
            // correo = 'a@a.com'
            console.log("opcion uno");            
            return await ctxFn.gotoFlow(agregarContacto)// cambiar el flow PARA IR AL WELCOME FLOW
        }else{       
            if (validarCorreo(ctx.body)) {
                correo = ctx.body;
                console.log('correo guardado');
                return await ctxFn.gotoFlow(agregarContacto)
            } else {
                return ctxFn.fallBack("el correo no es valido");
            }     
            
        }
      
})
const agregarContacto = addKeyword(EVENTS.ACTION)
.addAnswer("guardando contacto...",null,
    async (ctx,ctxFn)=>{
        try {
        // Registramos al nuevo contacto en Google Contacts
         const newContact = await peopleAPI.createContact(nombre, correo, telefono);
    
        // Después de registrar, damos la bienvenida
        await ctxFn.flowDynamic(`¡Gracias, ${nombre}! Has sido registrado correctamente.`);
    
        // Luego, lo redirigimos al flujo de bienvenida (simple saludo)
        return await ctxFn.gotoFlow(welcomeFlow);
        } catch (error) {
        await ctxFn.endFlow(`Hubo un error al registrar tu contacto. Por favor, intenta más tarde.`);
        console.error('Error al agregar el contacto:', error);
        }
        return await ctxFn.gotoFlow(welcomeFlow)             
})
const agregarUsuario = addKeyword(EVENTS.ACTION)       
        .addAnswer("Parece que no estás registrado. Vamos a agregar tu información.\nPor favor, ingresa tu nombre:", { capture: true },
            async (ctx,ctxFn)=>{
                console.log('body: ',ctx);
                console.log('contacts body: ',ctx.body);
                telefono = ctx.from.substring(3)
                nombre = ctx.body
                console.log('telefono: ',telefono)
                console.log('nombre: ',nombre)
                return await ctxFn.gotoFlow(agregarCorreo)             
        })

module.exports = { agregarUsuario, agregarCorreo, agregarContacto };