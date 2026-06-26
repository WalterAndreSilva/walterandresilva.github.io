const certImages = document.querySelectorAll('.cert-img');
const carruselContenedor = document.getElementById('contenedor-carrusel');
const modal = document.getElementById('modal-imagen');
const imgAmpliada = document.getElementById('img-ampliada');
const btnCerrar = document.querySelector('.cerrar-modal');

let indiceCentral = 0;
const totalImg = certImages.length;
let intervalo;

//--- LÓGICA SOBRE LAS PESTAÑAS -----------

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');

    navButtons.forEach(button => {
        button.addEventListener('click', (evento) => {
            evento.preventDefault();

            // Obtener el ID de la sección que queremos mostrar
            const targetId = button.getAttribute('data-target');

            // Ocultar todas las secciones
            sections.forEach(section => {
                section.classList.remove('active-section');
                section.classList.add('hidden-section');
            });

            // Quitar la clase 'active' de todos los botones
            navButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            // Mostrar la sección deseada
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden-section');
                targetSection.classList.add('active-section');
            }

            // Marcar el botón actual como activo
            button.classList.add('active');
        });
    });
});

//--- LÓGICA DEL CARRUSEL INFINITO Y MODAL -----------

// Función que asigna las clases CSS según la posición
function actualizarCarrusel() {
    if (totalImg === 0) return;

    certImages.forEach((img, index) => {
        img.classList.remove('activa', 'prev', 'next', 'oculta');

        if (index === indiceCentral) {
            img.classList.add('activa');
        } else if (index === (indiceCentral - 1 + totalImg) % totalImg) {
            img.classList.add('prev');
        } else if (index === (indiceCentral + 1) % totalImg) {
            img.classList.add('next');
        } else {
            img.classList.add('oculta');
        }
    });
}

function moverSiguiente() {
    indiceCentral = (indiceCentral + 1) % totalImg;
    actualizarCarrusel();
}

function iniciarCarrusel() {
    intervalo = setInterval(moverSiguiente, 3000); // 3 sec
}

function pausarCarrusel() {
    clearInterval(intervalo);
}

actualizarCarrusel();
iniciarCarrusel();

// Evento sobre las imagenes
certImages.forEach((img, index) => {
    img.addEventListener('click', (evento) => {
        if (evento.target.classList.contains('activa')) {
            imgAmpliada.src = evento.target.src;
            modal.classList.add('mostrar');
            pausarCarrusel();
        } else {
            indiceCentral = index;
            actualizarCarrusel();

            pausarCarrusel();
            iniciarCarrusel();
        }
    });
});

btnCerrar.addEventListener('click', () => {
    modal.classList.remove('mostrar');
    iniciarCarrusel();
});

modal.addEventListener('click', (evento) => {
    if (evento.target === modal) {
        modal.classList.remove('mostrar');
        iniciarCarrusel();
    }
});

