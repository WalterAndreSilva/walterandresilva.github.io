
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, onSnapshot, updateDoc, increment,
    collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp,
    orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged
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

// Elementos Auth HTML
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userInfo = document.getElementById("user-info");
const userPic = document.getElementById("user-pic");
const userName = document.getElementById("user-name");

// Elemento Botón Anónimo y su contenedor
const btnAnonimo = document.getElementById("btn-anonimo");
const accionAnonima = document.getElementById("accion-anonima");

// Botón filtro
const btnFiltroAnonimo = document.getElementById("btn-filtro-anonimo");

const listaHistorialUsuario = document.getElementById("lista-historial-usuario");
const listaHistorialGlobal = document.getElementById("lista-historial-global");

let chartHora, chart24Horas;
let usuarioActual = null;
let unsubscribeHistorialUsuario = null;
let unsubscribeHistorialGlobal = null;
let ocultarAnonimos = false;

// --- FUNCIÓN PARA REGISTRAR EN FIRESTORE ---
async function registrarPerdidaEnBD(esAnonimoForzado = false) {
    try {
        await addDoc(coleccionPerdidas, {
            fecha: serverTimestamp(),
                     nombre: (!esAnonimoForzado && usuarioActual) ? usuarioActual.displayName : "Anónimo",
                     foto: (!esAnonimoForzado && usuarioActual) ? usuarioActual.photoURL : null,
                     uid: (!esAnonimoForzado && usuarioActual) ? usuarioActual.uid : null
        });
        await updateDoc(docRefGlobal, { valor: increment(1) });
        actualizarGraficos();
    } catch (error) {
        console.error("Error al registrar en BD:", error);
    }
}

// --- LÓGICA DE VERIFICACIÓN DE PÉRDIDA (MIXTO: STORAGE PARA ANÓNIMOS, DB PARA USUARIOS) ---
async function verificarOProcesarPerdida(esAnonimoForzado = false) {
    const TIEMPO_ESPERA_MS = 60 * 60 * 1000; // 1 hora en milisegundos
    const ahora = Date.now();

    if (esAnonimoForzado) {
        const ultimaPerdida = localStorage.getItem("theGame_ultimaPerdida_Anonimo");

        if (!ultimaPerdida || (ahora - parseInt(ultimaPerdida)) > TIEMPO_ESPERA_MS) {
            localStorage.setItem("theGame_ultimaPerdida_Anonimo", ahora.toString());
            mensajeEstado.className = "estado-perdiste";
            mensajeEstado.innerHTML = "🥷 ¡Se ha registrado tu pérdida como Anónimo!";
            await registrarPerdidaEnBD(true);
        } else {
            mostrarInmunidad(TIEMPO_ESPERA_MS - (ahora - parseInt(ultimaPerdida)), true);
        }
    } else {
        if (!usuarioActual) return;

        mensajeEstado.className = "estado-info";
        mensajeEstado.innerHTML = "⏳ Verificando tu estado en la base de datos...";

        try {
            const qUltima = query(
                coleccionPerdidas,
                where("uid", "==", usuarioActual.uid),
                                  orderBy("fecha", "desc"),
                                  limit(1)
            );

            const snapshot = await getDocs(qUltima);
            let ultimaPerdidaMs = 0;

            if (!snapshot.empty) {
                const docData = snapshot.docs[0].data();
                if (docData.fecha) {
                    ultimaPerdidaMs = docData.fecha.toDate().getTime();
                }
            }

            if (ultimaPerdidaMs === 0 || (ahora - ultimaPerdidaMs) > TIEMPO_ESPERA_MS) {
                mensajeEstado.className = "estado-perdiste";
                mensajeEstado.innerHTML = "💥 ¡Bienvenido/a de nuevo! Has perdido en The Game.";
                await registrarPerdidaEnBD(false);
            } else {
                mostrarInmunidad(TIEMPO_ESPERA_MS - (ahora - ultimaPerdidaMs), false);
            }

        } catch (error) {
            console.error("Error al consultar la BD:", error);
            mensajeEstado.innerHTML = "⚠️ Hubo un error verificando tu estado.";
        }
    }
}

function mostrarInmunidad(tiempoRestanteMs, esAnonimo) {
    const minutosRestantes = Math.ceil(tiempoRestanteMs / (1000 * 60));
    mensajeEstado.className = "estado-salvo";
    mensajeEstado.innerHTML = `🛡️ Ya sumaste una pérdida recientemente${esAnonimo ? ' (Anónimo)' : ''}.<br>Estás inmune por aproximadamente <b>${minutosRestantes} minutos</b> más.`;
}

// --- ACCIONES DE BOTONES ---
btnAnonimo.addEventListener("click", async () => {
    btnAnonimo.disabled = true;
    await verificarOProcesarPerdida(true);
    setTimeout(() => { btnAnonimo.disabled = false; }, 2000);
});

btnFiltroAnonimo.addEventListener("click", () => {
    ocultarAnonimos = !ocultarAnonimos;

    if (ocultarAnonimos) {
        btnFiltroAnonimo.innerHTML = "🥷 Mostrar Todos";
        btnFiltroAnonimo.style.backgroundColor = "#ffc107";
    } else {
        btnFiltroAnonimo.innerHTML = "👁️ Ocultar Anónimos";
        btnFiltroAnonimo.style.backgroundColor = "#e0e0e0";
    }

    // Recargar el historial global con el nuevo filtro
    escucharHistorialGlobal();
});

// --- GESTIÓN DE SESIÓN CON GOOGLE ---
// --- VERIFICAR RESULTADO DE REDIRECCIÓN (Para celulares) ---
// Cuando el celular regresa de la página de Google, verificamos si hubo errores
getRedirectResult(auth).catch((error) => {
    console.error("Error al volver de la redirección de Google:", error);
    mensajeEstado.className = "estado-perdiste";
    mensajeEstado.innerHTML = "⚠️ No se pudo iniciar sesión en el móvil. Asegúrate de abrir la web en un navegador normal (Chrome/Safari).";
});

// --- GESTIÓN DE SESIÓN CON GOOGLE (Híbrido: PC y Móvil) ---
btnLogin.addEventListener("click", async () => {
    // Detectamos si es un dispositivo móvil (celular o tablet)
    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
        if (esMovil) {
            // En móviles redirigimos la página completa hacia Google
            await signInWithRedirect(auth, googleProvider);
        } else {
            // En PC abrimos la clásica ventana emergente (popup)
            await signInWithPopup(auth, googleProvider);
        }
    } catch (error) {
        console.error("Error al iniciar sesión:", error);

        // Si por alguna razón falla el popup en PC (ej. bloqueador de anuncios), usamos redirección como respaldo
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, googleProvider);
        }
    }
});
btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    usuarioActual = user;
    if (user) {
        btnLogin.classList.add("oculto");
        userInfo.classList.remove("oculto");
        if (accionAnonima) accionAnonima.classList.add("oculto");

        userName.textContent = user.displayName || "Jugador";
        userPic.src = user.photoURL || "https://ui-avatars.com/api/?name=" + (user.displayName || "X");

        cargarHistorialUsuario(user.uid);
        await verificarOProcesarPerdida(false);
    } else {
        btnLogin.classList.remove("oculto");
        userInfo.classList.add("oculto");
        if (accionAnonima) accionAnonima.classList.remove("oculto");

        mensajeEstado.className = "estado-info";
        mensajeEstado.innerHTML = "👀 Estás en modo espectador. Identifícate o usa el botón para sumar una pérdida.";

        if (unsubscribeHistorialUsuario) {
            unsubscribeHistorialUsuario();
        }
        listaHistorialUsuario.innerHTML = "<p class='cargando'>Inicia sesión para ver tu historial.</p>";
    }
});

// --- 1. ESCUCHAR HISTORIAL PERSONAL EN TIEMPO REAL ---
function cargarHistorialUsuario(uid) {
    if (unsubscribeHistorialUsuario) {
        unsubscribeHistorialUsuario();
    }

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
            <span>📅 ${fechaFormateada}</span>
            </div>
            <div class="fecha-info">⏰ las ${horaFormateada}</div>
            `;
            listaHistorialUsuario.appendChild(itemDiv);
        });
    }, (error) => {
        console.error("Error cargando historial personal:", error);
    });
}

// --- 2. ESCUCHAR HISTORIAL GLOBAL RECIENTE EN TIEMPO REAL ---
function escucharHistorialGlobal() {
    if (unsubscribeHistorialGlobal) {
        unsubscribeHistorialGlobal();
    }

    let qGlobal;
    if (ocultarAnonimos) {
        // Al usar "!=" en Firestore, primero se debe ordenar por la propiedad filtrada y luego por fecha
        qGlobal = query(
            coleccionPerdidas,
            where("nombre", "!=", "Anónimo"),
                        orderBy("nombre"),
                        orderBy("fecha", "desc"),
                        limit(10)
        );
    } else {
        qGlobal = query(coleccionPerdidas, orderBy("fecha", "desc"), limit(10));
    }

    unsubscribeHistorialGlobal = onSnapshot(qGlobal, (snapshot) => {
        if (snapshot.empty) {
            listaHistorialGlobal.innerHTML = "<p class='cargando'>No hay registros para mostrar con el filtro actual.</p>";
            return;
        }

        listaHistorialGlobal.innerHTML = "";

        // Al ordenar primero por 'nombre', la base nos las devuelve desordenadas en tiempo.
        // Por ello las acomodamos en JavaScript en estricto orden cronológico antes de mostrarlas:
        const documentos = [];
        snapshot.forEach((docSnap) => documentos.push(docSnap.data()));

        documentos.sort((a, b) => {
            const fechaA = a.fecha ? a.fecha.toDate().getTime() : 0;
            const fechaB = b.fecha ? b.fecha.toDate().getTime() : 0;
            return fechaB - fechaA; // Orden descendente (más recientes primero)
        });

        documentos.forEach((data) => {
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
        contadorElemento.textContent = `${docSnap.data().valor} juegos perdidos en total`;
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

// Inicializar la aplicación
inicializarGraficos();
escucharHistorialGlobal();
actualizarGraficos();
setInterval(actualizarGraficos, 120000);
