import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, onSnapshot, updateDoc, increment,
    collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp,
    orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6hFXNWgiXtDVsX5OeYOQCJJJnmVpzRR8",
    authDomain: "the-game-6642c.firebaseapp.com",
    projectId: "the-game-6642c",
    storageBucket: "the-game-6642c.firebasestorage.app",
    messagingSenderId: "906956439022",
    appId: "1:906956439022:web:8e7039119ba133ae5c62ff"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const docRefGlobal = doc(db, "contadores", "global");
const coleccionPerdidas = collection(db, "perdidas");

const contadorElemento = document.getElementById("contador");
const mensajeEstado = document.getElementById("mensaje-estado");
const listaHistorial = document.getElementById("lista-historial");

// Elementos Auth HTML
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userInfo = document.getElementById("user-info");
const userPic = document.getElementById("user-pic");
const userName = document.getElementById("user-name");

let chartHora, chart24Horas;
let usuarioActual = null;

// --- GESTIÓN DE SESIÓN CON GOOGLE ---
btnLogin.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
    }
});

btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    usuarioActual = user;
    if (user) {
        btnLogin.classList.add("oculto");
        userInfo.classList.remove("oculto");
        userName.textContent = user.displayName || "Jugador";
        userPic.src = user.photoURL || "https://ui-avatars.com/api/?name=" + (user.displayName || "X");
    } else {
        btnLogin.classList.remove("oculto");
        userInfo.classList.add("oculto");
    }
});

// Función central que registra pérdidas en Firestore (incluye datos del usuario si está logueado)
async function registrarPerdidaEnBD() {
    try {
        await addDoc(coleccionPerdidas, {
            fecha: serverTimestamp(),
                     nombre: usuarioActual ? usuarioActual.displayName : "Anónimo",
                     foto: usuarioActual ? usuarioActual.photoURL : null,
                     uid: usuarioActual ? usuarioActual.uid : null
        });
        await updateDoc(docRefGlobal, { valor: increment(1) });
        actualizarGraficos();
    } catch (error) {
        console.error("Error al registrar en BD:", error);
    }
}

// --- LÓGICA DE AUTOMATIZACIÓN DE VISITA (1 HORA) ---
async function verificarIngresoAutomatico() {
    const TIEMPO_ESPERA_MS = 60 * 60 * 1000; // 1 hora en milisegundos
    const ultimaPerdida = localStorage.getItem("theGame_ultimaPerdida");
    const ahora = Date.now();

    if (!ultimaPerdida || (ahora - parseInt(ultimaPerdida)) > TIEMPO_ESPERA_MS) {
        localStorage.setItem("theGame_ultimaPerdida", ahora.toString());

        mensajeEstado.className = "estado-perdiste";
        mensajeEstado.innerHTML = "💥 ¡Pensaste en el juego y perdiste! Se ha registrado tu pérdida automáticamente.";

        await registrarPerdidaEnBD();
    } else {
        const tiempoRestanteMs = TIEMPO_ESPERA_MS - (ahora - parseInt(ultimaPerdida));
        const minutosRestantes = Math.ceil(tiempoRestanteMs / (1000 * 60));

        mensajeEstado.className = "estado-salvo";
        mensajeEstado.innerHTML = `🛡️ Ya habías ingresado recientemente. No se sumó una nueva pérdida.<br>Estás inmune por aproximadamente <b>${minutosRestantes} minutos</b> más.`;
    }
}

// --- ESCUCHAR HISTORIAL DE PÉRDIDAS EN TIEMPO REAL ---
// Actualizamos las referencias a los dos nuevos contenedores en el HTML
const listaHistorialUsuario = document.getElementById("lista-historial-usuario");
const listaHistorialGlobal = document.getElementById("lista-historial-global");

let unsubscribeHistorialUsuario = null;

// --- GESTIÓN DE SESIÓN CON GOOGLE ---
btnLogin.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
    }
});

btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    usuarioActual = user;
    if (user) {
        btnLogin.classList.add("oculto");
        userInfo.classList.remove("oculto");
        userName.textContent = user.displayName || "Jugador";
        userPic.src = user.photoURL || "https://ui-avatars.com/api/?name=" + (user.displayName || "X");

        // Cargar historial personal en su propia lista
        cargarHistorialUsuario(user.uid);
    } else {
        btnLogin.classList.remove("oculto");
        userInfo.classList.add("oculto");

        if (unsubscribeHistorialUsuario) {
            unsubscribeHistorialUsuario();
        }
        listaHistorialUsuario.innerHTML = "<p class='cargando'>Inicia sesión con Google para ver tu historial.</p>";
    }

    await verificarIngresoAutomatico();
});

// --- 1. ESCUCHAR HISTORIAL PERSONAL EN TIEMPO REAL ---
function cargarHistorialUsuario(uid) {
    if (unsubscribeHistorialUsuario) {
        unsubscribeHistorialUsuario();
    }

    // Traer hasta 15 pérdidas del usuario actual
    const qUsuario = query(
        coleccionPerdidas,
        where("uid", "==", uid),
                           orderBy("fecha", "desc"),
                           limit(15)
    );

    unsubscribeHistorialUsuario = onSnapshot(qUsuario, (snapshot) => {
        if (snapshot.empty) {
            listaHistorialUsuario.innerHTML = "<p class='cargando'>Aún no tienes pérdidas registradas.</p>";
            return;
        }

        listaHistorialUsuario.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();

            let horaFormateada = "Recién";
            let fechaFormateada = "Hoy";
            if (data.fecha) {
                const fechaDate = data.fecha.toDate();
                horaFormateada = fechaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                fechaFormateada = fechaDate.toLocaleDateString();
            }

            const itemDiv = document.createElement("div");
            itemDiv.className = "item-historial";
            itemDiv.innerHTML = `
            <div class="jugador-info">
            <span>Fecha </span>
            </div>
            <div class="fecha-info">📅 ${fechaFormateada} a las ${horaFormateada}</div>
            `;
            listaHistorialUsuario.appendChild(itemDiv);
        });
    }, (error) => {
        console.error("Error cargando historial personal:", error);
    });
}

// --- 2. ESCUCHAR HISTORIAL GLOBAL RECIENTE EN TIEMPO REAL ---
function escucharHistorialGlobal() {
    // Consulta para los 10 últimos registros de cualquier jugador
    const qGlobal = query(coleccionPerdidas, orderBy("fecha", "desc"), limit(10));

    onSnapshot(qGlobal, (snapshot) => {
        if (snapshot.empty) {
            listaHistorialGlobal.innerHTML = "<p class='cargando'>Aún no hay registros globales.</p>";
            return;
        }

        listaHistorialGlobal.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const nombre = data.nombre || "Anónimo";
            const foto = data.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=ef5350&color=fff`;

            let horaFormateada = "Recién";
            if (data.fecha) {
                const fechaDate = data.fecha.toDate();
                horaFormateada = fechaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            const itemDiv = document.createElement("div");
            itemDiv.className = "item-historial";
            itemDiv.innerHTML = `
            <div class="jugador-info">
            <img src="${foto}" alt="Foto de ${nombre}" referrerpolicy="no-referrer">
            <span>${nombre}</span>
            </div>
            <div class="fecha-info">⏳ ${horaFormateada}</div>
            `;
            listaHistorialGlobal.appendChild(itemDiv);
        });
    }, (error) => {
        console.error("Error cargando historial global:", error);
    });
}

// Configurar Gráficos
function inicializarGraficos() {
    const ctxHora = document.getElementById('chartHora').getContext('2d');
    chartHora = new Chart(ctxHora, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Personas', data: [], backgroundColor: '#ef5350' }] },
        options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const ctx24 = document.getElementById('chart24Horas').getContext('2d');
    chart24Horas = new Chart(ctx24, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Personas', data: [], borderColor: '#d32f2f', backgroundColor: 'rgba(211, 47, 47, 0.1)', fill: true }] },
                             options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// Escuchar Contador Global en Tiempo Real
onSnapshot(docRefGlobal, (docSnap) => {
    if (docSnap.exists()) {
        contadorElemento.textContent = `${docSnap.data().valor} perdedores totales`;
    }
});

// Cargar y Procesar Gráficos
async function actualizarGraficos() {
    const ahora = new Date();
    const hace24Horas = new Date(ahora.getTime() - (24 * 60 * 60 * 1000));

    const q = query(coleccionPerdidas, where("fecha", ">=", Timestamp.fromDate(hace24Horas)));
    const querySnapshot = await getDocs(q);

    const eventos = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.fecha) eventos.push(data.fecha.toDate());
    });

        const cubetasHora = new Array(6).fill(0);
        const etiquetasHora = [];
        for(let i = 5; i >= 0; i--) {
            etiquetasHora.push(`-${(i+1)*10}m`);
        }

        const cubetas24 = new Array(24).fill(0);
        const etiquetas24 = [];
        for(let i = 23; i >= 0; i--) {
            const h = new Date(ahora.getTime() - (i * 60 * 60 * 1000));
            etiquetas24.push(`${h.getHours()}:00`);
        }

        eventos.forEach(fecha => {
            const diffMinutos = (ahora - fecha) / (1000 * 60);
            const diffHoras = (ahora - fecha) / (1000 * 60 * 60);

            if (diffMinutos <= 60) {
                const indice = 5 - Math.floor(diffMinutos / 10);
                if (indice >= 0 && indice < 6) cubetasHora[indice]++;
            }

            if (diffHoras <= 24) {
                const indice = 23 - Math.floor(diffHoras);
                if (indice >= 0 && indice < 24) cubetas24[indice]++;
            }
        });

        chartHora.data.labels = etiquetasHora;
        chartHora.data.datasets[0].data = cubetasHora;
        chartHora.update();

        chart24Horas.data.labels = etiquetas24;
        chart24Horas.data.datasets[0].data = cubetas24;
        chart24Horas.update();
}

// Inicializar la aplicación apenas abre la web
inicializarGraficos();
escucharHistorialGlobal();
actualizarGraficos();
setInterval(actualizarGraficos, 120000);
