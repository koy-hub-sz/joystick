
let motorDataWebsocket;
let motorSpeedWebsocket;

// ======================================
// CONFIGURAÇÕES DOS MOTORES
// ======================================

let motorDirections = {

    "C": {
        leftMotor: [0, 0, 1],
        rightMotor: [0, 0, 1],
    },

    "N": {
        leftMotor: [1, 0, 1],
        rightMotor: [1, 0, 1],
    },

    "S": {
        leftMotor: [1, 0, 1],
        rightMotor: [1, 0, 1],
    },

    "W": {
        leftMotor: [1, 1, 0],
        rightMotor: [1, 0, 1],
    },

    "E": {
        leftMotor: [1, 0, 1],
        rightMotor: [1, 1, 0],
    }

};

// ======================================
// VARIÁVEIS DE CONTROLE
// ======================================

let direcaoAtual = "C";
let velocidadeAtual = 0;

const velocidadeMaxima = 32;
const velocidadeDash = 32;
const anguloServo = 90;

let dashEmAndamento = false;
let dashDisponivel = true;

const duracaoDash = 350;
const tempoRecargaDash = 10;

let intervaloRecarga = null;
let temporizadorDash = null;

let lastDirection = "";
let lastSpeed = -1;

// ======================================
// ELEMENTOS HTML
// ======================================

const botoes = document.querySelectorAll(".controle");

const statusConexao = document.getElementById("connectionStatus");

const botaoConectar = document.getElementById("botao");

const botaoDash = document.getElementById("botaoDash");

const botaoDano = document.getElementById("botaoDano");

const elementoVidas = document.getElementById("vidas");

const quadradinhosVida = document.querySelectorAll(".vida-quadrado");

const gameOverOverlay = document.getElementById("gameOverOverlay");

const barraStamina = document.getElementById("stamina");

const contadorStamina = document.getElementById("staminaTimer");

// ======================================
// SISTEMA DE VIDA
// ======================================

let vidaRobo = 3;

function atualizarVida() {

    elementoVidas.classList.remove(
        "vida-cheia",
        "vida-media",
        "vida-critica"
    );

    quadradinhosVida.forEach((quadrado, index) => {

        if (index < vidaRobo) {
            quadrado.classList.remove("perdida");
        } else {
            quadrado.classList.add("perdida");
        }

    });

    if (vidaRobo === 3) {

        elementoVidas.classList.add("vida-cheia");

    } else if (vidaRobo === 2) {

        elementoVidas.classList.add("vida-media");

    } else if (vidaRobo === 1) {

        elementoVidas.classList.add("vida-critica");

    } else if (vidaRobo === 0) {

        mostrarGameOver();

    }

}

// ======================================
// RECEBER DANO
// ======================================

function tirarVida() {

    if (vidaRobo <= 0) {
        return;
    }

    vidaRobo--;

    atualizarVida();

}

// ======================================
// GAME OVER
// ======================================

function mostrarGameOver() {

    gameOverOverlay.style.display = "flex";

    gameOverOverlay.setAttribute("aria-hidden", "false");

    botaoDano.disabled = true;
    botaoDash.disabled = true;

    botoes.forEach(botao => {

        botao.disabled = true;
        botao.classList.remove("ativo");

    });

    // CANCELA O DASH SE ESTIVER EM ANDAMENTO

    if (temporizadorDash) {

        clearTimeout(temporizadorDash);
        temporizadorDash = null;

    }

    // CANCELA A RECARGA

    if (intervaloRecarga) {

        clearInterval(intervaloRecarga);
        intervaloRecarga = null;

    }

    dashEmAndamento = false;

    pararRobo();

}

// ======================================
// SISTEMA DE STAMINA
// ======================================

function atualizarStamina(valor) {

    const porcentagem = Math.max(0, Math.min(100, valor));

    barraStamina.style.width = porcentagem + "%";

}

// ======================================
// UTILIZAR DASH
// ======================================

function usarDash() {

    // VERIFICA SE O DASH ESTÁ DISPONÍVEL

    if (!dashDisponivel || dashEmAndamento || vidaRobo <= 0) {
        return;
    }

    // BLOQUEIA O DASH

    dashDisponivel = false;
    dashEmAndamento = true;

    botaoDash.disabled = true;

    // ZERA A STAMINA

    barraStamina.style.transition = "none";

    atualizarStamina(0);

    // INICIA A RECARGA

    iniciarRecargaDash();

    // EXECUTA A ARRANCADA PARA FRENTE

    direcaoAtual = "N";
    velocidadeAtual = velocidadeDash;

    enviarDados();

    // FINALIZA O DASH APÓS 350 MILISSEGUNDOS

    temporizadorDash = setTimeout(() => {

        dashEmAndamento = false;

        temporizadorDash = null;

        pararRobo();

    }, duracaoDash);

}

// ======================================
// RECARGA DO DASH
// ======================================

function iniciarRecargaDash() {

    const tempoInicial = Date.now();

    const tempoFinal = tempoInicial + (tempoRecargaDash * 1000);

    contadorStamina.textContent = "10s";

    // PREPARA A ANIMAÇÃO

    barraStamina.style.transition = "none";

    atualizarStamina(0);

    // FORÇA A ATUALIZAÇÃO VISUAL

    barraStamina.offsetWidth;

    // ANIMAÇÃO DE PREENCHIMENTO EM 10 SEGUNDOS

    barraStamina.style.transition = "width 10s linear";

    barraStamina.style.width = "100%";

    // ATUALIZA O CONTADOR

    intervaloRecarga = setInterval(() => {

        const tempoRestante = tempoFinal - Date.now();

        const segundosRestantes = Math.max(
            0,
            Math.ceil(tempoRestante / 1000)
        );

        contadorStamina.textContent = segundosRestantes + "s";

        if (tempoRestante <= 0) {

            finalizarRecargaDash();

        }

    }, 100);

}

// ======================================
// FINALIZAR RECARGA
// ======================================

function finalizarRecargaDash() {

    clearInterval(intervaloRecarga);

    intervaloRecarga = null;

    atualizarStamina(100);

    contadorStamina.textContent = "STAMINA CHEIA";

    // LIBERA O DASH

    dashDisponivel = true;

    botaoDash.disabled = false;

}

// ======================================
// CONEXÃO COM O ROBÔ
// ======================================

function connect() {

    const url = document.getElementById("wsUrl").value.trim().replace(/\/+$/, "");

    if (!url) {

        alert("Informe o endereço do robô!");

        return;

    }

    disconnect();

    try {

        motorDataWebsocket = new WebSocket(url + "/motor_data");

        motorSpeedWebsocket = new WebSocket(url + "/motor_speed");

        motorDataWebsocket.onopen = verificarConexao;

        motorSpeedWebsocket.onopen = verificarConexao;

        motorDataWebsocket.onerror = erroConexao;

        motorSpeedWebsocket.onerror = erroConexao;

        motorDataWebsocket.onclose = verificarConexao;

        motorSpeedWebsocket.onclose = verificarConexao;

    } catch (erro) {

        console.error("Erro ao conectar:", erro);

        statusConexao.textContent = "Erro na conexão";

    }

}

// ======================================
// VERIFICAR CONEXÃO
// ======================================

function verificarConexao() {

    const conectado =
        motorDataWebsocket &&
        motorSpeedWebsocket &&
        motorDataWebsocket.readyState === WebSocket.OPEN &&
        motorSpeedWebsocket.readyState === WebSocket.OPEN;

    if (conectado) {

        statusConexao.textContent = "Conectado ao robô";

        statusConexao.style.color = "green";

        botaoConectar.textContent = "Conectado";

    } else {

        statusConexao.textContent = "Erro ao conectar";

        statusConexao.style.color = "red";

        botaoConectar.textContent = "Conectar Robô";

    }

}

// ======================================
// ERRO DE CONEXÃO
// ======================================

function erroConexao() {

    statusConexao.textContent = "Erro na conexão";

    statusConexao.style.color = "red";

}

// ======================================
// DESCONECTAR
// ======================================

function disconnect() {

    pararRobo();

    if (motorDataWebsocket) {

        motorDataWebsocket.close();
        motorDataWebsocket = null;

    }

    if (motorSpeedWebsocket) {

        motorSpeedWebsocket.close();
        motorSpeedWebsocket = null;

    }

    verificarConexao();

}

// ======================================
// ENVIAR DADOS PARA O ROBÔ
// ======================================

function enviarDados() {

    // SEM CONEXÃO, O SISTEMA CONTINUA FUNCIONANDO
    // APENAS NÃO ENVIA OS COMANDOS AO ESP32

    if (
        !motorDataWebsocket ||
        !motorSpeedWebsocket ||
        motorDataWebsocket.readyState !== WebSocket.OPEN ||
        motorSpeedWebsocket.readyState !== WebSocket.OPEN
    ) {

        return;

    }

    const direcao = direcaoAtual;

    const motor_directions = motorDirections[direcao];

    const reverse = direcao === "S" ? 1 : 0;

    const motor_speed = velocidadeAtual;

    // DADOS DOS MOTORES

    const payloadMotor = {

        motor_directions: motor_directions,

        reverse: reverse,

        servo_angle: anguloServo,

        timestamp: Date.now()

    };

    // DADOS DA VELOCIDADE

    const payloadVelocidade = {

        motor_speed: motor_speed,

        timestamp: Date.now()

    };

    motorDataWebsocket.send(JSON.stringify(payloadMotor));

    motorSpeedWebsocket.send(JSON.stringify(payloadVelocidade));

    lastDirection = direcao;

    lastSpeed = motor_speed;

}

// ======================================
// MOVIMENTAR O ROBÔ
// ======================================

function moverRobo(direcao) {

    if (vidaRobo <= 0 || dashEmAndamento) {
        return;
    }

    if (!motorDirections[direcao]) {
        return;
    }

    direcaoAtual = direcao;

    velocidadeAtual = velocidadeMaxima;

    enviarDados();

}

// ======================================
// PARAR O ROBÔ
// ======================================

function pararRobo() {

    direcaoAtual = "C";

    velocidadeAtual = 0;

    enviarDados();

}

// ======================================
// CONTROLES DIRECIONAIS
// ======================================

botoes.forEach(botao => {

    const direcao = botao.dataset.direcao;

    // PRESSIONAR

    botao.addEventListener("pointerdown", function(event) {

        event.preventDefault();

        if (vidaRobo <= 0 || dashEmAndamento) {
            return;
        }

        botao.setPointerCapture(event.pointerId);

        botao.classList.add("ativo");

        moverRobo(direcao);

    });

    // SOLTAR

    function soltarBotao() {

        botao.classList.remove("ativo");

        if (!dashEmAndamento) {

            pararRobo();

        }

    }

    botao.addEventListener("pointerup", soltarBotao);

    botao.addEventListener("pointercancel", soltarBotao);

    botao.addEventListener("lostpointercapture", soltarBotao);

});

// ======================================
// INICIALIZAÇÃO
// ======================================

atualizarVida();

atualizarStamina(100);

contadorStamina.textContent = "STAMINA CHEIA";
