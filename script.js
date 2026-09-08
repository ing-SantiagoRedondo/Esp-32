// ============================================================
// CONFIGURACION — debe coincidir EXACTAMENTE con el ESP32
// ============================================================
const TOPIC_ESTADO  = "clase/decoder/santiago123/estado";
const TOPIC_CONTROL = "clase/decoder/santiago123/control";

const displayNum = document.getElementById("display_num");
const bitsRow    = document.getElementById("bits-row");
const origenEl   = document.getElementById("origen");
const ledEl      = document.getElementById("led");
const estadoEl   = document.getElementById("estado-texto");
const consoleEl  = document.getElementById("console");
const teclado    = document.getElementById("teclado");

function horaActual(){
  const d = new Date();
  return d.toTimeString().slice(0,8);
}

function log(mensaje, tipo){
  const row = document.createElement("div");
  row.className = "row" + (tipo ? " " + tipo : "");
  row.innerHTML = `<span class="t">${horaActual()}</span>${mensaje}`;
  consoleEl.appendChild(row);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

document.getElementById("clear-log").onclick = () => { consoleEl.innerHTML = ""; };

function setLed(estado){
  ledEl.className = "led";
  if (estado === "ok")    ledEl.classList.add("on-teal");
  if (estado === "error") ledEl.classList.add("on-red");
  if (estado === "wait")  ledEl.classList.add("on-amber");
}

// ---- Generar teclado 1..9 + 0 en orden telefónico ----
for (let i = 1; i <= 10; i++){
  const numero = i === 10 ? 0 : i;
  const btn = document.createElement("button");
  btn.className = "key";
  if (numero === 0) btn.classList.add("key-zero");
  btn.textContent = numero;
  btn.onclick = () => enviarComando(numero, btn);
  teclado.appendChild(btn);
}

// ============================================================
// CLIENTE MQTT (WebSockets sobre TLS — puerto 8884 de HiveMQ)
// ============================================================
setLed("wait");
estadoEl.textContent = "Conectando al broker…";

const client = new Paho.MQTT.Client(
  "broker.hivemq.com",
  8884,
  "web_santiago123_" + Math.random().toString(16).slice(2)
);

client.onConnectionLost = (resp) => {
  setLed("error");
  estadoEl.innerHTML = "Conexión perdida";
  log("Conexión perdida: " + (resp.errorMessage || "sin detalle"), "err");
};

client.onMessageArrived = (message) => {
  try {
    const datos = message.payloadString.split(",");
    if (datos.length !== 2) return;

    const [binario, decimalStr] = datos;
    const num = parseInt(decimalStr, 10);

    if (!isNaN(num) && num >= 0 && num <= 9 && binario.length === 4) {
      displayNum.textContent = decimalStr;

      [...bitsRow.children].forEach((bit, idx) => {
        const alto = binario[idx] === "1";
        bit.textContent = binario[idx];
        bit.classList.toggle("hi", alto);
      });

      origenEl.textContent = "DIP switch";
      log(`RX ${message.destinationName} → ${binario},${decimalStr}`, "rx");
    } else {
      log("RX payload inválido: " + message.payloadString, "err");
    }
  } catch (e) {
    log("Error en onMessageArrived: " + e.message, "err");
  }
};

client.connect({
  useSSL: true,
  timeout: 10,
  onSuccess: () => {
    setLed("ok");
    estadoEl.innerHTML = "<b>Conectado</b> · escuchando estado";
    log("Conectado al broker", "rx");
    client.subscribe(TOPIC_ESTADO);
  },
  onFailure: (err) => {
    setLed("error");
    estadoEl.textContent = "Error: " + err.errorMessage;
    log("Fallo de conexión: " + err.errorMessage, "err");
  }
});

// ============================================================
// ENVIAR COMANDO AL ESP32
// ============================================================
function enviarComando(numero, btnRef){
  if (numero < 0 || numero > 9) return;

  try {
    const msg = new Paho.MQTT.Message(String(numero));
    msg.destinationName = TOPIC_CONTROL;
    client.send(msg);

    displayNum.textContent = numero;
    origenEl.textContent = "teclado web";
    log(`TX ${TOPIC_CONTROL} → ${numero}`, "tx");

    if (btnRef){
      btnRef.classList.add("sent");
      setTimeout(() => btnRef.classList.remove("sent"), 250);
    }
  } catch (e) {
    log("Error al enviar: " + e.message, "err");
  }
}
