import { pb, ROLES, requerirSesion, cerrarSesion, esPersonal, suscribir } from "./api.js"
import { icono } from "./iconos.js"
import { $, avatar, aviso, escapar, prepararHojas } from "./ui.js"
import { abrirPaleta } from "./paleta.js"
import { abrirAsistente } from "./asistente.js"

const SECCIONES = [
  { id: "hoy", texto: "Hoy", enlace: "index.html", icono: "hoy", visible: () => true },
  { id: "tablero", texto: "Tablero", enlace: "ordenes.html", icono: "tablero", visible: () => true },
  { id: "clientes", texto: "Clientes", enlace: "clientes.html", icono: "clientes", visible: esPersonal },
  { id: "repuestos", texto: "Repuestos", enlace: "repuestos.html", icono: "repuestos", visible: () => true },
  { id: "reportes", texto: "Reportes", enlace: "reportes.html", icono: "reportes", visible: esPersonal },
]

const temaActual = () => document.documentElement.dataset.tema || "oscuro"

const cambiarTema = () => {
  const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro"
  document.documentElement.dataset.tema = nuevo
  try {
    localStorage.setItem("tema", nuevo)
  } catch (_) {
    aviso("No se pudo recordar el tema en este navegador.", "alerta")
  }
  $("#boton-tema").innerHTML = icono(nuevo === "oscuro" ? "sol" : "luna")
}

const pintarCabecera = (usuario, activa) => {
  const visibles = SECCIONES.filter((s) => s.visible())
  const cabecera = $("#cabecera")
  cabecera.className = "cabecera"
  cabecera.innerHTML = `
    <a class="marca" href="index.html"><span class="marca__icono">${icono("piston")}</span><span>El Pistón</span></a>
    <nav class="pestanas" aria-label="Secciones">
      ${visibles.map((s) => `<a class="pestana ${s.id === activa ? "pestana--activa" : ""}" href="${s.enlace}" ${s.id === activa ? 'aria-current="page"' : ""}>${s.texto}</a>`).join("")}
    </nav>
    <div class="cabecera__acciones">
      <button type="button" class="buscador-global" id="abrir-paleta" aria-label="Buscar">
        ${icono("buscar")}<span class="buscador-global__texto">Buscar matrícula, cliente…</span><kbd>Ctrl K</kbd>
      </button>
      ${esPersonal() ? `<button type="button" class="boton boton--chico boton-escritorio" id="nueva-orden-escritorio">${icono("mas")}Nueva orden</button>` : ""}
      <button type="button" class="icono-boton" id="boton-tema" aria-label="Cambiar tema">${icono(temaActual() === "oscuro" ? "sol" : "luna")}</button>
      <div class="usuario">
        <button type="button" class="usuario__boton" id="boton-usuario" aria-haspopup="menu" aria-expanded="false">${avatar(usuario.name || usuario.email)}</button>
        <div class="menu-flotante oculto" id="menu-usuario" role="menu">
          <div class="menu-flotante__cabecera">
            <strong>${escapar(usuario.name || usuario.email)}</strong>
            <div class="etiqueta">${escapar(ROLES[usuario.rol] ?? usuario.rol)}</div>
          </div>
          ${esPersonal() ? `<a class="menu-flotante__opcion" role="menuitem" href="reportes.html">${icono("reportes")}Reportes</a>` : ""}
          <button type="button" class="menu-flotante__opcion menu-flotante__opcion--peligro" role="menuitem" id="boton-salir">${icono("salir")}Cerrar sesión</button>
        </div>
      </div>
    </div>`

  const movil = visibles.filter((s) => s.id !== "reportes").slice(0, 4)
  const enlaceMovil = (s) => `<a class="barra-movil__enlace ${s.id === activa ? "barra-movil__enlace--activo" : ""}" href="${s.enlace}">${icono(s.icono)}<span>${s.texto}</span></a>`
  const barra = $("#barra-movil")
  barra.className = "barra-movil"
  barra.setAttribute("aria-label", "Navegación")
  barra.innerHTML = `
    ${movil.slice(0, 2).map(enlaceMovil).join("")}
    <button type="button" class="fab" id="fab" aria-label="${esPersonal() ? "Nueva orden" : "Buscar"}">${icono(esPersonal() ? "mas" : "buscar")}</button>
    ${movil.slice(2).map(enlaceMovil).join("")}
    ${movil.length < 4 ? '<span></span>'.repeat(4 - movil.length) : ""}`
}

const conectarCabecera = () => {
  const menu = $("#menu-usuario")
  const boton = $("#boton-usuario")
  boton.addEventListener("click", (evento) => {
    evento.stopPropagation()
    const abierto = menu.classList.toggle("oculto") === false
    boton.setAttribute("aria-expanded", String(abierto))
  })
  document.addEventListener("click", () => {
    menu.classList.add("oculto")
    boton.setAttribute("aria-expanded", "false")
  })
  $("#boton-salir").addEventListener("click", cerrarSesion)
  $("#boton-tema").addEventListener("click", cambiarTema)
  $("#abrir-paleta").addEventListener("click", () => abrirPaleta())
  $("#nueva-orden-escritorio")?.addEventListener("click", () => abrirAsistente())
  $("#fab").addEventListener("click", () => (esPersonal() ? abrirAsistente() : abrirPaleta()))
}

const atajos = () => {
  document.addEventListener("keydown", (evento) => {
    const escribiendo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
      evento.preventDefault()
      abrirPaleta()
    } else if (!escribiendo && evento.key === "/") {
      evento.preventDefault()
      abrirPaleta()
    } else if (!escribiendo && evento.key.toLowerCase() === "n" && esPersonal() && !document.querySelector("dialog[open]")) {
      evento.preventDefault()
      abrirAsistente()
    }
  })
}

const vigilarExistencias = () =>
  suscribir("repuestos", ({ action, record }) => {
    if (action === "update" && record.existencias <= record.stock_minimo) {
      aviso(`${record.nombre}: quedan ${record.existencias} unidades`, "alerta")
    }
  })

export const iniciarPagina = async (activa) => {
  const usuario = await requerirSesion()
  if (!usuario) return null
  pintarCabecera(usuario, activa)
  conectarCabecera()
  prepararHojas()
  atajos()
  vigilarExistencias()
  window.addEventListener("offline", () => aviso("Sin conexión de red", "error"))
  window.addEventListener("online", () => aviso("Conexión restablecida"))
  window.addEventListener("pagehide", () => pb.realtime.unsubscribe())
  document.body.classList.add("listo")
  return usuario
}
