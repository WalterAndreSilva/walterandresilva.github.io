document.addEventListener('DOMContentLoaded', () => {
    const formNovedad = document.getElementById('form-novedad');
    const inputNovedad = document.getElementById('input-novedad');
    const listaNovedades = document.getElementById('lista-novedades');

    formNovedad.addEventListener('submit', function(evento) {
        // Evitar que la página se recargue al enviar el formulario
        evento.preventDefault();

        // Obtener el texto del input y eliminar espacios en blanco al inicio/final
        const texto = inputNovedad.value.trim();

        if (texto !== '') {
            // Obtener la fecha de hoy formateada (ej. 14/06/2026)
            const fechaActual = new Date().toLocaleDateString('es-AR');

            // Crear el nuevo elemento de lista (li)
            const nuevoElemento = document.createElement('li');
            nuevoElemento.innerHTML = `<strong>${fechaActual}:</strong> ${texto}`;

            // Agregar el nuevo elemento al principio de la lista
            listaNovedades.prepend(nuevoElemento);

            // Limpiar el campo de texto
            inputNovedad.value = '';
        }
    });
});