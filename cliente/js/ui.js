import { MONEDA } from "./config.js"
import { icono } from "./iconos.js"
import { mensajeError } from "./api.js"

export const ESTADOS = {
  recibida: { texto: "Recibida", corto: "Recibida", siguiente: "diagnostico" },
  diagnostico: { texto: "En diagnóstico", corto: "Diagnóstico", siguiente: "reparacion" },
  reparacion: { texto: "En reparación", corto: "Reparación", siguiente: "lista" },
  lista: { texto: "Lista para entregar", corto: "Lista", siguiente: "entregada" },
  entregada: { texto: "Entregada", corto: "Entregada", siguiente: null },
  cancelada: { texto: "Cancelada", corto: "Cancelada", siguiente: null },
}

export const ESTADOS_ABIERTOS = ["recibida", "diagnostico", "reparacion", "lista"]
export const FILTRO_ABIERTAS = 'estado != "entregada" && estado != "cancelada"'

export const estaCerrada = (estado) => estado === "entregada" || estado === "cancelada"

export const $ = (selector, raiz = document) => raiz.querySelector(selector)
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)]

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
export const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c])

const formatoDinero = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatoEntero = new Intl.NumberFormat("es-ES")
const formatoRelativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

export const dinero = (valor) => `${formatoDinero.format(Number(valor) || 0)} ${MONEDA}`
export const entero = (valor) => formatoEntero.format(Number(valor) || 0)

export const aFecha = (valor) => (valor instanceof Date ? valor : valor ? new Date(String(valor).replace(" ", "T")) : null)

export const fecha = (valor) => {
  const f = aFecha(valor)
  return f ? f.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"
}

export const fechaHora = (valor) => {
  const f = aFecha(valor)
  return f ? f.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"
}

export const hace = (valor) => {
  const f = aFecha(valor)
  if (!f) return "—"
  const minutos = Math.round((f.getTime() - Date.now()) / 60000)
  if (Math.abs(minutos) < 60) return formatoRelativo.format(minutos, "minute")
  const horas = Math.round(minutos / 60)
  if (Math.abs(horas) < 24) return formatoRelativo.format(horas, "hour")
  return formatoRelativo.format(Math.round(horas / 24), "day")
}

export const aIsoServidor = (fechaLocal) => fechaLocal.toISOString().replace("T", " ")

export const valorFechaHoraLocal = (f = new Date()) =>
  new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export const valorFechaLocal = (f = new Date()) => valorFechaHoraLocal(f).slice(0, 10)

export const iniciales = (nombre = "") =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?"

export const tonoAvatar = (texto = "") =>
  `avatar--tono-${([...texto].reduce((suma, c) => suma + c.charCodeAt(0), 0) % 4) + 1}`

export const avatar = (nombre, tamano = "") =>
  `<span class="avatar ${tamano} ${tonoAvatar(nombre)}" title="${escapar(nombre)}">${escapar(iniciales(nombre))}</span>`

export const estado = (valor) =>
  `<span class="estado estado--${escapar(valor)}">${escapar(ESTADOS[valor]?.texto ?? valor)}</span>`

export const placa = (matricula, grande = false) =>
  `<span class="placa ${grande ? "placa--grande" : ""}">${escapar(matricula)}</span>`

export const vacio = (mensaje, nombreIcono = "caja") =>
  `<div class="vacio">${icono(nombreIcono)}<p>${escapar(mensaje)}</p></div>`

export const cargando = (filas = 3) => Array.from({ length: filas }, () => '<div class="carga"></div>').join("")

export const parametro = (nombre) => new URLSearchParams(location.search).get(nombre)

export const datosFormulario = (formulario) => Object.fromEntries(new FormData(formulario))

export const retrasar = (funcion, ms = 300) => {
  let temporizador
  return (...argumentos) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => funcion(...argumentos), ms)
  }
}

export const aviso = (mensaje, tipo = "exito") => {
  const contenedor = $("#avisos")
  if (!contenedor) return
  const elemento = document.createElement("div")
  elemento.className = `aviso aviso--${tipo}`
  elemento.setAttribute("role", tipo === "error" ? "alert" : "status")
  elemento.textContent = mensaje
  contenedor.append(elemento)
  setTimeout(() => elemento.classList.add("aviso--saliendo"), 3800)
  setTimeout(() => elemento.remove(), 4200)
}

export const conCarga = async (boton, accion) => {
  if (!boton) return accion()
  boton.disabled = true
  boton.classList.add("boton--cargando")
  try {
    return await accion()
  } finally {
    boton.disabled = false
    boton.classList.remove("boton--cargando")
  }
}

export const abrirHoja = (hoja) => {
  hoja.showModal()
  hoja.querySelector("[autofocus], input:not([type=hidden]), select, textarea")?.focus()
}

export const cerrarHoja = (hoja) => {
  hoja.close()
  hoja.querySelector("form")?.reset()
  const error = hoja.querySelector(".error-formulario")
  if (error) error.textContent = ""
}

export const prepararHojas = () => {
  $$("dialog.hoja:not([data-preparada])").forEach((hoja) => {
    hoja.dataset.preparada = "si"
    $$("[data-cerrar]", hoja).forEach((boton) => boton.addEventListener("click", () => cerrarHoja(hoja)))
    hoja.addEventListener("click", (evento) => {
      if (evento.target === hoja) cerrarHoja(hoja)
    })
  })
}

export const hoja = ({ id, titulo, cuerpo, pie, clase = "" }) => `
  <dialog class="hoja ${clase}" id="${id}" aria-labelledby="${id}-titulo">
    <form novalidate>
      <div class="hoja__asa"></div>
      <div class="hoja__cabecera">
        <h2 id="${id}-titulo">${titulo}</h2>
        <button type="button" class="icono-boton" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button>
      </div>
      <div class="hoja__cuerpo">
        <div class="formulario">${cuerpo}<p class="error-formulario" aria-live="assertive"></p></div>
      </div>
      <div class="hoja__pie">${pie}</div>
    </form>
  </dialog>`

export const confirmar = (mensaje, textoAceptar = "Confirmar", peligro = true) =>
  new Promise((resolver) => {
    const contenedor = document.createElement("div")
    contenedor.innerHTML = `
      <dialog class="hoja hoja--confirmar">
        <div class="hoja__asa"></div>
        <div class="hoja__cuerpo"><p>${escapar(mensaje)}</p></div>
        <div class="hoja__pie">
          <button type="button" class="boton boton--sobrio" value="no">Volver</button>
          <button type="button" class="boton ${peligro ? "boton--peligro" : ""}" value="si">${escapar(textoAceptar)}</button>
        </div>
      </dialog>`
    const dialogo = contenedor.firstElementChild
    const terminar = (respuesta) => {
      dialogo.close()
      dialogo.remove()
      resolver(respuesta)
    }
    dialogo.addEventListener("click", (evento) => {
      if (evento.target.value === "si") terminar(true)
      else if (evento.target.value === "no" || evento.target === dialogo) terminar(false)
    })
    dialogo.addEventListener("cancel", (evento) => {
      evento.preventDefault()
      terminar(false)
    })
    document.body.append(dialogo)
    dialogo.showModal()
  })

export const mostrarError = (formulario, mensaje) => {
  const destino = formulario.querySelector(".error-formulario")
  if (destino) destino.textContent = mensaje
  else aviso(mensaje, "error")
}

export const alEnviar = (formulario, accion) => {
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    mostrarError(formulario, "")
    if (!formulario.checkValidity()) {
      formulario.reportValidity()
      return
    }
    await conCarga(formulario.querySelector("button[type=submit]"), async () => {
      try {
        await accion(datosFormulario(formulario))
      } catch (error) {
        mostrarError(formulario, mensajeError(error))
      }
    })
  })
}

export const segmentos = (contenedor, alCambiar) => {
  contenedor.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".segmento")
    if (!boton) return
    $$(".segmento", contenedor).forEach((b) => b.setAttribute("aria-pressed", String(b === boton)))
    alCambiar(boton.dataset.valor)
  })
}
