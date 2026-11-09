import { pb, mensajeError } from "./api.js"
import { icono } from "./iconos.js"
import { guardarCliente, guardarVehiculo } from "./registros.js"
import {
  $, $$, aIsoServidor, avatar, conCarga, entero, escapar, placa, retrasar, valorFechaHoraLocal,
} from "./ui.js"

const SINTOMAS = ["Cambio de aceite", "Revisión general", "Ruido al frenar", "No arranca", "Pierde fuerza", "Luz del tablero encendida", "Vibración", "Calentamiento"]

let dialogo = null
let paso = 1
let estado = {}

const plantilla = () => `
  <dialog class="hoja" id="asistente" aria-labelledby="asistente-titulo">
    <form novalidate>
      <div class="hoja__asa"></div>
      <div class="hoja__cabecera">
        <div>
          <div class="etiqueta" id="asistente-paso">Paso 1 de 3</div>
          <h2 id="asistente-titulo">¿Qué vehículo llegó?</h2>
        </div>
        <button type="button" class="icono-boton" data-accion="cerrar" aria-label="Cerrar">${icono("cerrar")}</button>
      </div>
      <div class="pasos-asistente"><span></span><span></span><span></span></div>
      <div class="hoja__cuerpo">
        <section data-paso="1" class="formulario">
          <label class="campo-busqueda">${icono("buscar")}<input type="search" class="entrada" id="asistente-buscar" placeholder="Matrícula, marca o nombre del cliente" autocomplete="off"></label>
          <div id="asistente-resultados"></div>
          <button type="button" class="boton boton--sobrio" data-accion="nuevo">${icono("mas")}Cliente o vehículo nuevo</button>
          <div id="asistente-nuevo" class="formulario formulario--par oculto">
            <label class="campo ancho-total"><span>Nombre del cliente</span><input name="nombre" maxlength="120" autocomplete="name"></label>
            <label class="campo"><span>Teléfono</span><input name="telefono" type="tel" pattern="[0-9+ \\(\\)\\-]{6,20}"></label>
            <label class="campo"><span>Matrícula</span><input name="matricula" pattern="[A-Za-z0-9\\- ]{4,12}" autocapitalize="characters"></label>
            <label class="campo"><span>Marca</span><input name="marca" maxlength="60"></label>
            <label class="campo"><span>Modelo</span><input name="modelo" maxlength="60"></label>
            <label class="campo"><span>Año</span><input name="anio" type="number" min="1940" max="2100"></label>
          </div>
        </section>
        <section data-paso="2" class="formulario oculto">
          <div class="campo"><span>Mecánico</span><div class="mecanicos" id="asistente-mecanicos"></div></div>
          <label class="campo"><span>Problema que reporta el cliente</span><textarea id="asistente-problema" maxlength="1000" placeholder="Describa lo que nota el cliente"></textarea></label>
          <div class="fichas" id="asistente-sintomas">${SINTOMAS.map((s) => `<button type="button" class="ficha" data-sintoma="${s}">${s}</button>`).join("")}</div>
          <div class="formulario formulario--par">
            <label class="campo"><span>Kilometraje</span><input type="number" id="asistente-km" min="0" inputmode="numeric"><small id="asistente-km-ayuda">Opcional</small></label>
            <label class="campo"><span>Entrada</span><input type="datetime-local" id="asistente-fecha"></label>
          </div>
        </section>
        <section data-paso="3" class="formulario oculto">
          <div class="resumen-asistente" id="asistente-resumen"></div>
        </section>
        <p class="error-formulario" aria-live="assertive"></p>
      </div>
      <div class="hoja__pie">
        <button type="button" class="boton boton--sobrio" data-accion="atras">Atrás</button>
        <button type="button" class="boton" data-accion="siguiente">Siguiente</button>
      </div>
    </form>
  </dialog>`

const error = (mensaje = "") => {
  $(".error-formulario", dialogo).textContent = mensaje
}

const tarjetaVehiculo = (v) => `
  <button type="button" class="resultado" data-vehiculo="${v.id}" aria-selected="${estado.vehiculo?.id === v.id}">
    ${placa(v.matricula)}
    <span class="resultado__cuerpo"><strong>${escapar(v.marca)} ${escapar(v.modelo)} ${v.anio}</strong><br><small class="tenue">${escapar(v.expand?.cliente?.nombre)} · ${entero(v.kilometraje)} km</small></span>
  </button>`

let vehiculosMostrados = []

const buscarVehiculos = async (texto = "") => {
  const contenedor = $("#asistente-resultados", dialogo)
  try {
    const resultado = await pb.collection("vehiculos").getList(1, 6, {
      filter: texto ? pb.filter("matricula ~ {:q} || marca ~ {:q} || modelo ~ {:q} || cliente.nombre ~ {:q}", { q: texto }) : "",
      sort: "-updated",
      expand: "cliente",
    })
    vehiculosMostrados = resultado.items
    contenedor.innerHTML = `<div class="etiqueta">${texto ? "Coincidencias" : "Vehículos recientes"}</div>${resultado.items.map(tarjetaVehiculo).join("") || '<p class="tenue">No hay coincidencias. Registre un vehículo nuevo.</p>'}`
  } catch (e) {
    contenedor.innerHTML = `<p class="tenue">${escapar(mensajeError(e))}</p>`
  }
}

const cargarMecanicos = async () => {
  const [mecanicos, carga] = await Promise.all([
    pb.collection("users").getFullList({ filter: 'rol = "mecanico"', sort: "name", fields: "id,name" }),
    pb.collection("carga_mecanicos").getFullList(),
  ])
  const abiertas = Object.fromEntries(carga.map((c) => [c.id, c.abiertas]))
  const sugerido = [...mecanicos].sort((a, b) => (abiertas[a.id] ?? 0) - (abiertas[b.id] ?? 0))[0]
  if (!estado.mecanico && sugerido) estado.mecanico = sugerido
  estado.mecanicos = mecanicos
  $("#asistente-mecanicos", dialogo).innerHTML = mecanicos.map((m) => `
    <button type="button" class="opcion-mecanico" data-mecanico="${m.id}" aria-pressed="${estado.mecanico?.id === m.id}">
      ${avatar(m.name)}
      <span><strong>${escapar(m.name)}</strong><small>${abiertas[m.id] ?? 0} abiertas${m.id === sugerido?.id ? " · sugerido" : ""}</small></span>
    </button>`).join("")
}

const irAPaso = (nuevo) => {
  paso = nuevo
  error()
  const titulos = { 1: "¿Qué vehículo llegó?", 2: "Detalles del servicio", 3: "Revise y registre" }
  $("#asistente-titulo", dialogo).textContent = titulos[paso]
  $("#asistente-paso", dialogo).textContent = `Paso ${paso} de 3`
  $$(".pasos-asistente span", dialogo).forEach((s, i) => s.classList.toggle("hecho", i < paso))
  $$("[data-paso]", dialogo).forEach((s) => s.classList.toggle("oculto", Number(s.dataset.paso) !== paso))
  $("[data-accion=atras]", dialogo).classList.toggle("oculto", paso === 1)
  $("[data-accion=siguiente]", dialogo).textContent = paso === 3 ? "Registrar orden" : "Siguiente"
  if (paso === 2) {
    const km = estado.vehiculo?.kilometraje ?? 0
    $("#asistente-km", dialogo).min = km
    $("#asistente-km-ayuda", dialogo).textContent = estado.vehiculo ? `Último registro: ${entero(km)} km` : "Opcional"
  }
  if (paso === 3) pintarResumen()
}

const datosNuevo = () => {
  const campos = Object.fromEntries($$("#asistente-nuevo input", dialogo).map((i) => [i.name, i.value.trim()]))
  return campos
}

const validarPaso1 = () => {
  if (estado.modoNuevo) {
    const d = datosNuevo()
    const faltan = ["nombre", "telefono", "matricula", "marca", "modelo", "anio"].filter((c) => !d[c])
    if (faltan.length) return "Complete los datos del cliente y del vehículo."
    if (!$$("#asistente-nuevo input", dialogo).every((i) => i.checkValidity())) return "Revise el teléfono, la matrícula y el año."
    estado.nuevo = d
    return ""
  }
  return estado.vehiculo ? "" : "Elija un vehículo o registre uno nuevo."
}

const validarPaso2 = () => {
  estado.problema = $("#asistente-problema", dialogo).value.trim()
  estado.kilometraje = Number($("#asistente-km", dialogo).value || 0)
  estado.fecha = $("#asistente-fecha", dialogo).value
  if (!estado.mecanico) return "Elija el mecánico."
  if (estado.problema.length < 3) return "Describa el problema."
  if (estado.vehiculo && estado.kilometraje && estado.kilometraje < estado.vehiculo.kilometraje) return `El kilometraje no puede ser menor que ${entero(estado.vehiculo.kilometraje)} km.`
  if (!estado.fecha) return "Indique la fecha de entrada."
  return ""
}

const pintarResumen = () => {
  const v = estado.modoNuevo ? estado.nuevo : estado.vehiculo
  const cliente = estado.modoNuevo ? estado.nuevo.nombre : estado.vehiculo.expand?.cliente?.nombre
  $("#asistente-resumen", dialogo).innerHTML = `
    <div>${placa(estado.modoNuevo ? v.matricula.toUpperCase().replace(/\s+/g, "") : v.matricula, true)}</div>
    <div><div class="etiqueta">Vehículo</div><strong>${escapar(v.marca)} ${escapar(v.modelo)} ${escapar(v.anio)}</strong></div>
    <div><div class="etiqueta">Cliente</div><strong>${escapar(cliente)}</strong>${estado.modoNuevo ? ' <span class="tenue">(nuevo)</span>' : ""}</div>
    <div><div class="etiqueta">Mecánico</div><strong>${escapar(estado.mecanico.name)}</strong></div>
    <div><div class="etiqueta">Problema</div>${escapar(estado.problema)}</div>
    <div><div class="etiqueta">Kilometraje</div>${estado.kilometraje ? `${entero(estado.kilometraje)} km` : "No indicado"}</div>`
}

const registrar = async () => {
  let vehiculoId = estado.vehiculo?.id
  if (estado.modoNuevo) {
    const cliente = await guardarCliente(estado.nuevo)
    const vehiculo = await guardarVehiculo({ ...estado.nuevo, cliente: cliente.id, kilometraje: 0 })
    vehiculoId = vehiculo.id
    estado.modoNuevo = false
    estado.vehiculo = { ...vehiculo, expand: { cliente } }
  }
  const orden = await pb.collection("ordenes").create({
    vehiculo: vehiculoId,
    mecanico: estado.mecanico.id,
    problema: estado.problema,
    kilometraje: estado.kilometraje,
    fecha_entrada: aIsoServidor(new Date(estado.fecha)),
    estado: "recibida",
  })
  location.href = `orden.html?id=${orden.id}`
}

const avanzar = async (boton) => {
  const mensaje = paso === 1 ? validarPaso1() : paso === 2 ? validarPaso2() : ""
  if (mensaje) {
    error(mensaje)
    return
  }
  if (paso < 3) {
    irAPaso(paso + 1)
    return
  }
  await conCarga(boton, async () => {
    try {
      await registrar()
    } catch (e) {
      error(mensajeError(e))
    }
  })
}

const conectar = () => {
  $("#asistente-buscar", dialogo).addEventListener("input", retrasar((e) => buscarVehiculos(e.target.value.trim()), 250))
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close()
    const objetivo = evento.target.closest("button")
    if (!objetivo) return
    const { accion, vehiculo, mecanico, sintoma } = objetivo.dataset
    if (accion === "cerrar") dialogo.close()
    if (accion === "atras") irAPaso(paso - 1)
    if (accion === "siguiente") avanzar(objetivo)
    if (accion === "nuevo") {
      estado.modoNuevo = !estado.modoNuevo
      estado.vehiculo = null
      $("#asistente-nuevo", dialogo).classList.toggle("oculto", !estado.modoNuevo)
      $$("[data-vehiculo]", dialogo).forEach((b) => b.setAttribute("aria-selected", "false"))
      if (estado.modoNuevo) $("#asistente-nuevo input", dialogo).focus()
    }
    if (vehiculo) {
      estado.vehiculo = vehiculosMostrados.find((v) => v.id === vehiculo)
      estado.modoNuevo = false
      $("#asistente-nuevo", dialogo).classList.add("oculto")
      $$("[data-vehiculo]", dialogo).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.vehiculo === vehiculo)))
      irAPaso(2)
    }
    if (mecanico) {
      estado.mecanico = estado.mecanicos.find((m) => m.id === mecanico)
      $$("[data-mecanico]", dialogo).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mecanico === mecanico)))
    }
    if (sintoma) {
      const area = $("#asistente-problema", dialogo)
      area.value = area.value ? `${area.value.replace(/[.\s]*$/, "")}. ${sintoma}` : sintoma
      objetivo.setAttribute("aria-pressed", "true")
    }
  })
}

export const abrirAsistente = async ({ vehiculoId = "" } = {}) => {
  if (!dialogo) {
    const contenedor = document.createElement("div")
    contenedor.innerHTML = plantilla()
    dialogo = contenedor.firstElementChild
    document.body.append(dialogo)
    conectar()
  }
  estado = {}
  dialogo.querySelector("form").reset()
  $("#asistente-nuevo", dialogo).classList.add("oculto")
  $$("[data-sintoma]", dialogo).forEach((b) => b.setAttribute("aria-pressed", "false"))
  $("#asistente-fecha", dialogo).value = valorFechaHoraLocal()
  irAPaso(1)
  dialogo.showModal()
  try {
    await cargarMecanicos()
    if (vehiculoId) {
      estado.vehiculo = await pb.collection("vehiculos").getOne(vehiculoId, { expand: "cliente" })
      irAPaso(2)
    } else {
      await buscarVehiculos()
      $("#asistente-buscar", dialogo).focus()
    }
  } catch (e) {
    error(mensajeError(e))
  }
}
