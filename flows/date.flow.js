const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { text2iso, iso2text,convertToDate,isAfternoon,isMorning,isValidDate,isFutureDate } = require("../scripts/utils")
const { isDateAvailable, getNextAvailableSlot } = require("../scripts/calendar")
// const { chat } = require("../scripts/chatgpt")

const { formFlow } = require("./form.flow")
let response="";

const promptBase = `
    Sos un asistente virtual diseñado para ayudar a los usuarios a agendar citas mediante una conversación. 
    Tu objetivo es unicamente ayudar al usuario a elegir un horario y una fecha para sacar turno.
    Te voy a dar la fecha solicitada por el usuario y la disponibilidad de la misma. Esta fecha la tiene que confirmar el usuario. 
    Si la disponibilidad es true, entonces responde algo como: La fecha solicitada esta disponible. El turno sería el Jueves 30 de mayo 2024 a las 10:00hs
    Si la disponibilidad es false, entonces recomenda la siguiente fecha disponible que te dejo al final del prompt, suponiendo que la siguiente fecha disponible es el Jueves 30, responde con este formato: La fecha y horario solicitados no estan disponibles, te puedo ofrecer el Jueves 30 de mayo 2024 a las 11:00hs.
    Bajo ninguna circunstancia hagas consultas.
    En vez de decir que la disponibilidad es false, envia una disculpa de que esa fecha no esta disponible, y ofrecer la siguiente.
    Te dejo los estados actualizados de dichas fechas
`;

const confirmationFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Confirmas la fecha propuesta? Responde unicamente con 'si' o 'no'", { capture: true },
        async (ctx, ctxFn) => {
            if (ctx.body.toLowerCase().includes("si")) {
                return ctxFn.gotoFlow(formFlow)
            } else {
                await ctxFn.endFlow("Reseva cancelada. Volve a solicitar una reserva para elegir otra fecha.")
            }
        })

const firstavailability = addKeyword(EVENTS.ACTION)
.addAnswer("Revisando disponibilidad...",null,
    async (ctx, ctxFn) => {
        console.log("opcion uno....");    
        const nextdateAvailable = await getNextAvailableSlot(new Date);
        console.log('next availability: ', nextdateAvailable);
        await ctxFn.flowDynamic("la cita mas proxima es en esta fecha y hora :")
        const year = nextdateAvailable.start.getFullYear();
        const month = String(nextdateAvailable.start.getMonth() + 1).padStart(2, '0'); // getMonth() returns 0-11, so add 1
        const day = String(nextdateAvailable.start.getDate()).padStart(2, '0');
        const time = String(nextdateAvailable.start.getDate()).padStart(2, '0');
        const hour = nextdateAvailable.start.getHours();
        const min = nextdateAvailable.start.getMinutes();
        const minutes= (min < 10 ? '0' : '') + min;
        console.log(year , month, day,hour,(min < 10 ? '0' : '') + min )
        const dateString=day+'/'+month+'/'+year+' '+hour+':'+minutes;
        await ctxFn.flowDynamic(dateString)
        await ctxFn.state.update({ date: nextdateAvailable.start });
        return ctxFn.gotoFlow(confirmationFlow);
    })

    let requestedDate = null; 
    const specificDateFlow = addKeyword(EVENTS.ACTION)   
    .addAnswer("Por favor, escribe la fecha que deseas agendar en el formato DD/MM/AAAA, por ejemplo 01/02/2024.", { capture: true },
        async (ctx, ctxFn) => {
            const dateInput = ctx.body.trim();
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
                return ctxFn.fallBack("La fecha proporcionada no es válida. Por favor, intenta nuevamente.");
            }

            // Convertimos la fecha ingresada a un objeto Date
            requestedDate = convertToDate(dateInput);

            // Verificamos si la fecha es válida
            if (!isValidDate(requestedDate)) {
                return ctxFn.fallBack("La fecha proporcionada no es válida. Por favor, intenta nuevamente.");
            }
               // Verificamos si la fecha está en el futuro
            if (!isFutureDate(requestedDate)) {
                return ctxFn.fallBack("La fecha proporcionada ya ha pasado. Por favor, ingresa una fecha futura.");
            }

            console.log("Fecha válida ingresada:", requestedDate);

            return ctxFn.flowDynamic("¿Prefieres la cita por la *mañana* o por la *tarde*? Responde con 'mañana' o 'tarde'.");
        })
    .addAnswer("Esperando la respuesta de mañana o tarde...", { capture: true },
        async (ctx, ctxFn) => {
            const preference = ctx.body.toLowerCase();
            if (preference !== "mañana" && preference !== "tarde") {
                return ctxFn.fallBack("Por favor, responde con 'mañana' o 'tarde'.");
            }

            // Verificamos si se ha almacenado la fecha
            if (!requestedDate || !isValidDate(requestedDate)) {
                return ctxFn.fallBack("Ha ocurrido un error con la fecha. Por favor, vuelve a ingresar la fecha.");
            }

            // Determinar si la preferencia es mañana o tarde
            const isPreferredTime = preference === "mañana" ? isMorning : isAfternoon;

            let nextAvailable = await getNextAvailableSlot(requestedDate);

            // Buscar la primera cita disponible en la mañana o tarde según la preferencia
            while (!isPreferredTime(nextAvailable.start)) {
                nextAvailable = await getNextAvailableSlot(nextAvailable.start);
            }

            // Validamos que la fecha de la cita es válida antes de continuar
            if (!isValidDate(nextAvailable.start)) {
                return ctxFn.fallBack("La cita generada no es válida. Intenta nuevamente.");
            }

            const year = nextAvailable.start.getFullYear();
            const month = String(nextAvailable.start.getMonth() + 1).padStart(2, '0');
            const day = String(nextAvailable.start.getDate()).padStart(2, '0');
            const hour = nextAvailable.start.getHours();
            const min = String(nextAvailable.start.getMinutes()).padStart(2, '0');
            const dateString = `${day}/${month}/${year} ${hour}:${min}`;

            console.log("Cita generada correctamente:", nextAvailable.start);

            await ctxFn.flowDynamic(`La primera cita disponible por la ${preference} es: ${dateString}`);
            await ctxFn.state.update({ date: nextAvailable.start });
            return ctxFn.gotoFlow(confirmationFlow);
        });



const dateFlow = addKeyword(EVENTS.ACTION)
        .addAnswer("Perfecto! por favor escribe un:")
        .addAnswer("*1* para agendar en la fecha mas proxima")
        .addAnswer("*2* para seleccionar una fecha especifica", { capture: true },
            async (ctx,ctxFn)=>{
            if(!["1","2"].includes(ctx.body)){
                return ctxFn.fallBack("no es una respuesta valida");
            }
            if(ctx.body==="1"){
                console.log("opcion uno");
                return await ctxFn.gotoFlow(firstavailability)
            }
            if(ctx.body==="2"){
                console.log("opcion dos");
                return await ctxFn.gotoFlow(specificDateFlow);
            }
            console.log("capture ",ctx.body)
        })
        //  .addAnswer("Revisando disponibilidad...", null,null)
        // async (ctx,ctxFn)=>{
        //     if(!["1","2"].includes(ctx.body)){
        //         return ctxFn.fallBack("no es una respuesta valida");
        //     }
        //     if(ctx.body===1){
        //         console.log("opcion uno");
        //     }
        //     if(ctx.body===2){
        //         console.log("opcion dos");
        //     }
        //     console.log("capture ",ctx.body)
        // })
    // .addAnswer("Perfecto! Que fecha queres agendar?", { capture: true })
    // .addAnswer("Revisando disponibilidad...", null,
        // async (ctx, ctxFn) => {
        //     const currentDate = new Date();
        //     // const solicitedDate = await text2iso(ctx.body)
        //     const solicitedDate = "TRUE";
        //     //console.log("Fecha solicitada: " + solicitedDate)
        //     if (solicitedDate.includes("false")) {
        //         return ctxFn.endFlow("No se pudo deducir una fecha. Volve a preguntar")
        //     }
        //     // const startDate = new Date(solicitedDate);
        //     const startDate = new Date();
        //     //console.log("Start Date: " + startDate)
        //     let dateAvailable = await isDateAvailable(startDate)
        //     console.log('dateAvailable//////////////////// ',dateAvailable);
        //     //console.log("Is Date Available: " + dateAvailable + " Type: " + typeof dateAvailable)

        //     if (dateAvailable === false) {
        //         const nextdateAvailable = await getNextAvailableSlot(startDate)
        //         //console.log("Fecha recomendada: " + nextdateAvailable.start)
        //         const isoString = nextdateAvailable.start.toISOString();
        //         const dateText = await iso2text(isoString)
        //         //console.log("Fecha texto: " + dateText)
        //         const messages = [{ role: "user", content: `${ctx.body}` }];
        //         //const response = await chat(promptBase + "\nHoy es el dia: " + currentDate + "\nLa fecha solicitada es: " + solicitedDate + "\nLa disponibilidad de esa fecha es: false. El Proximo espacio disponible posible que tenes que ofrecer es: " + dateText + "Da la fecha siempre en español", messages)
        //         await ctxFn.flowDynamic(response)
        //         await ctxFn.state.update({ date: nextdateAvailable.start });
        //         return ctxFn.gotoFlow(confirmationFlow)
        //     } else {
        //         const messages = [{ role: "user", content: `${ctx.body}` }];
        //         //const response = await chat(promptBase + "\nHoy es el dia: " + currentDate + "\nLa fecha solicitada es: " + solicitedDate + "\nLa disponibilidad de esa fecha es: true" + "\nConfirmación del cliente: No confirmo", messages)
        //         await ctxFn.flowDynamic(response)
        //         await ctxFn.state.update({ date: startDate });
        //         return ctxFn.gotoFlow(confirmationFlow)
        //     }
        // })

module.exports = { dateFlow, confirmationFlow, firstavailability,specificDateFlow };