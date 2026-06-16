document.addEventListener('DOMContentLoaded', () => {
    // Seleccionamos todos los botones de navegación y todas las secciones de contenido
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');

    navButtons.forEach(button => {
        button.addEventListener('click', (evento) => {
            // 1. Evitar que el enlace recargue la página
            evento.preventDefault();

            // 2. Obtener el ID de la sección que queremos mostrar
            const targetId = button.getAttribute('data-target');

            // 3. Ocultar todas las secciones
            sections.forEach(section => {
                section.classList.remove('active-section');
                section.classList.add('hidden-section');
            });

            // 4. Quitar la clase 'active' de todos los botones
            navButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            // 5. Mostrar la sección deseada
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden-section');
                targetSection.classList.add('active-section');
            }

            // 6. Marcar el botón actual como activo
            button.classList.add('active');
        });
    });
});
