

## Cómo ejecutar

1. Descargar PocketBase **v0.40.x** desde <https://pocketbase.io/docs/> y colocar el ejecutable en `servidor/`.
2. Abrir una terminal en `servidor/` y ejecutar:

   ```bash
   ./pocketbase serve --http=0.0.0.0:8090 --publicDir=../cliente
   ```

   En Windows: `pocketbase.exe serve --http=0.0.0.0:8090 --publicDir=../cliente`
3. Abrir <http://127.0.0.1:8090>. En un teléfono conectado a la misma red Wi-Fi, abrir `http://IP-DE-LA-PC:8090`.
4. Panel de administración: <http://127.0.0.1:8090/_/> con `admin@elpiston.cu` / `admin-piston-2026`.

También se puede iniciar solo el servidor y abrir `cliente/` con Live Server en VS Code (en `.vscode/` está la tarea "Iniciar PocketBase").

Cuentas de demostración (contraseña `piston2026`): `dueno@elpiston.cu`, `recepcion@elpiston.cu`, `raul@elpiston.cu`, `yoandry@elpiston.cu`. En la pantalla de entrada, tocar una cuenta rellena el correo.

| Aspecto | Versión 1 | Versión 2 |
|---|---|---|
| Estilo visual | Claro, gris y naranja, esquinas redondeadas | Oscuro por defecto con amarillo de señalización; tema claro opcional que se recuerda en el navegador |
| Navegación | Menú lateral (PC) y barra inferior (móvil) | Pestañas en la cabecera (PC); barra inferior con botón central flotante (móvil) |
| Búsqueda | Un buscador distinto en cada lista | Búsqueda global con `Ctrl K` o `/`: órdenes, vehículos, clientes y repuestos en un solo lugar, manejable con el teclado |
| Inicio | Panel de indicadores | "Hoy": cifras del día, barra de órdenes por estado, cola de trabajo con botón para avanzar cada orden, avisos de lo que requiere atención y carga de cada mecánico |
| Órdenes | Lista paginada con filtros | Tablero tipo kanban: se arrastra la tarjeta a otra columna para cambiar el estado (en el móvil, con su botón). La columna "Entregadas hoy" sirve para entregar. Hay una vista de historial aparte |
| Nueva orden | Un formulario largo en un diálogo | Asistente en 3 pasos: elegir o crear el vehículo (y el cliente) en la misma ventana, mecánico sugerido según su carga, síntomas frecuentes con un toque, y revisión final. Se abre desde cualquier pantalla con `N` o con el botón + |
| Detalle de orden | Una página larga con tablas | Cabecera con la placa, el avance por pasos (se toca un paso para mover la orden) y pestañas Trabajos / Repuestos / Pagos. La cuenta queda fija al costado (PC) o en una barra inferior (móvil) |
| Repuestos de una orden | Lista desplegable | Hoja con buscador y existencias visibles; los agotados no se pueden elegir |
| Cobros | Formulario siempre visible | Hoja de cobro con botones "Todo" y "Mitad" y selector de método de pago |
| Clientes | Lista y ficha en páginas separadas | Maestro-detalle: lista agrupada por letra y ficha al lado. Botones para llamar y escribir por WhatsApp. Se busca también por matrícula |
| Vehículo | Lista de órdenes | Línea de tiempo con lo que se hizo y lo que se cobró en cada visita |
| Inventario | Tabla | Tarjetas con medidor de existencias (suficiente, justo, por agotarse, agotado), entradas rápidas de +1, +5, +10 y +20, y orden configurable |
| Reportes | Tablas | Gráfico SVG de facturado y cobrado por día, períodos rápidos, deuda por cliente con barras y carga apilada por estado |
| Formularios | Diálogos centrados | Hojas que suben desde abajo (móvil) o se deslizan desde la derecha (PC) |
| Avisos | Esquina inferior | Arriba en el móvil y abajo a la derecha en la PC |

## Estructura del cliente

```
cliente/
├── index.html        Hoy
├── ordenes.html      Tablero e historial
├── orden.html        Detalle de una orden
├── clientes.html     Maestro-detalle de clientes
├── vehiculo.html     Línea de tiempo del vehículo
├── repuestos.html    Inventario
├── reportes.html     Reportes
├── login.html
├── css/app.css       Sistema de diseño con variables para los dos temas
└── js/
    ├── tema.js         Aplica el tema guardado antes de pintar la página (evita un parpadeo)
    ├── config.js       URL del servidor y moneda
    ├── api.js          SDK, sesión, roles, errores en español
    ├── ui.js           Formatos, placas, estados, hojas, confirmaciones, avisos
    ├── iconos.js       Iconos SVG propios
    ├── plantilla.js    Cabecera, barra móvil, menú de usuario, atajos de teclado
    ├── paleta.js       Búsqueda global
    ├── asistente.js    Asistente de nueva orden
    ├── flujo.js        Reglas de interfaz para mover órdenes entre estados
    ├── formularios.js  Campos compartidos de cliente, vehículo y repuesto
    ├── registros.js    Normalización y guardado de registros
    └── paginas/        Un módulo por página
```

## Decisiones de diseño de la interfaz

1. **Placa de matrícula como elemento de identidad.** En un taller el carro se reconoce por la chapa, así que cada orden y cada vehículo se muestran con una placa amarilla en letra monoespaciada.
2. **El tablero refleja el taller físico.** Cada columna es un estado. Mover la tarjeta equivale a mover el carro de un lugar a otro, y el cambio se guarda y se ve en las demás pantallas en tiempo real.
3. **Validar antes de mover.** `flujo.js` comprueba si el usuario puede llevar una orden a un estado: el mecánico no puede entregar ni cancelar, ni mover órdenes de otro. La columna no acepta la tarjeta si el movimiento no está permitido, y las reglas del servidor lo vuelven a comprobar.
4. **Sugerir en lugar de preguntar.** El asistente propone al mecánico con menos órdenes abiertas y muestra el último kilometraje como mínimo.
5. **Oscuro por defecto.** El tema oscuro es cómodo con poca luz, en pantallas viejas y para los mecánicos que lo ven en el teléfono. El tema claro sirve para recepción con luz de día y se recuerda en `localStorage`, con `try/catch` por si el navegador no lo permite.
6. **Accesible.** La interfaz se puede usar con el teclado (atajos y navegación con flechas en la búsqueda), lleva roles y `aria-*` en pestañas, segmentos y diálogos, el foco es visible y respeta `prefers-reduced-motion`.
7. **Sin dependencias externas.** Iconos, gráficos y fuentes son propios o del sistema: funciona en una red local sin internet.
