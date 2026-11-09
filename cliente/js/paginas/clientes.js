import { pb, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { CAMPOS_CLIENTE, CAMPOS_VEHICULO, pieGuardar } from "../formularios.js"
import { guardarCliente, guardarVehiculo, rellenarFormulario } from "../registros.js"
import { icono } from "../iconos.js"
import {
  $, $$, abrirHoja, alEnviar, avatar, aviso, cargando, cerrarHoja, dinero, entero, escapar, estaCerrada, estado, fecha,
  hoja, placa, prepararHojas, retrasar, vacio,
} from "../ui.js"

let clientes = []
let seleccionado = new URLSearchParams(location.search).get("id")
let detalle = null
let pestana = "vehiculos"

const telefonoWhatsApp = (telefono) => String(telefono).replace(/\D/g, "")

const pintarLista = () => {
  const grupos = {}
  for (const c of clientes) {
    const letra = c.nombre[0].toUpperCase()
    ;(grupos[letra] ??= []).push(c)
  }
  $("#total-clientes").textContent = `${entero(clientes.length)} clientes`
  $("#lista-clientes").innerHTML = Object.entries(grupos).map(([letra, lista]) => `
    <div class="grupo-letra etiqueta">${letra}</div>
    ${lista.map((c) => `
      <a class="fila ${c.id === seleccionado ? "fila--seleccionada" : ""}" href="clientes.html?id=${c.id}" data-cliente="${c.id}">
        ${avatar(c.nombre)}
        <div class="fila__cuerpo">
          <div class="fila__titulo">${escapar(c.nombre)}</div>
          <div class="fila__sub">${escapar(c.telefono)} · ${(c.expand?.vehiculos_via_cliente ?? []).map((v) => escapar(v.matricula)).join(", ") || "sin vehículos"}</div>
        </div>
      </a>`).join("")}`).join("") || vacio("No hay clientes con ese nombre.", "clientes")
}

const cargarLista = async (texto = "") => {
  if (!clientes.length) $("#lista-clientes").innerHTML = cargando(5)
  try {
    clientes = await pb.collection("clientes").getFullList({
      filter: texto ? pb.filter("nombre ~ {:q} || telefono ~ {:q} || vehiculos_via_cliente.matricula ?~ {:q}", { q: texto }) : "",
      sort: "nombre",
      expand: "vehiculos_via_cliente",
    })
    pintarLista()
  } catch (error) {
    $("#lista-clientes").innerHTML = vacio(mensajeError(error), "alerta")
  }
}

const pintarDetalle = () => {
  const { cliente, vehiculos, ordenes } = detalle
  const validas = ordenes.filter((o) => o.estado !== "cancelada")
  const saldo = validas.reduce((s, o) => s + o.saldo, 0)
  const facturado = validas.reduce((s, o) => s + o.total, 0)
  const abiertas = ordenes.filter((o) => !estaCerrada(o.estado)).length
  $("#detalle-cliente").innerHTML = `
    <a href="clientes.html" class="volver volver--movil" data-volver>${icono("flecha")}Todos los clientes</a>
    <section class="heroe">
      <div class="heroe__arriba">
        <div class="heroe__identidad">
          ${avatar(cliente.nombre, "avatar--grande")}
          <div>
            <h1>${escapar(cliente.nombre)}</h1>
            <div class="tenue">${escapar(cliente.direccion || "Sin dirección registrada")}</div>
          </div>
        </div>
        <div class="contacto">
          <a class="boton boton--sobrio boton--chico" href="tel:${escapar(cliente.telefono)}">${icono("telefono")}Llamar</a>
          <a class="boton boton--sobrio boton--chico" href="https://wa.me/${telefonoWhatsApp(cliente.telefono)}" target="_blank" rel="noopener">${icono("mensaje")}WhatsApp</a>
          <button type="button" class="boton boton--sobrio boton--chico" data-editar-cliente>${icono("lapiz")}Editar</button>
        </div>
      </div>
    </section>
    <section class="cifras">
      <div class="cifra"><span class="etiqueta">Vehículos</span><span class="cifra__valor">${vehiculos.length}</span></div>
      <div class="cifra"><span class="etiqueta">Abiertas</span><span class="cifra__valor">${abiertas}</span></div>
      <div class="cifra"><span class="etiqueta">Facturado</span><span class="cifra__valor">${dinero(facturado)}</span></div>
      <div class="cifra ${saldo > 0 ? "cifra--peligro" : "cifra--ok"}"><span class="etiqueta">Debe</span><span class="cifra__valor">${dinero(saldo)}</span></div>
    </section>
    <section class="bloque">
      <div class="pestanas-internas" role="tablist">
        <button type="button" class="pestana-interna" role="tab" data-pestana-cliente="vehiculos" aria-selected="${pestana === "vehiculos"}">Vehículos<span class="contador">${vehiculos.length}</span></button>
        <button type="button" class="pestana-interna" role="tab" data-pestana-cliente="historial" aria-selected="${pestana === "historial"}">Historial<span class="contador">${ordenes.length}</span></button>
      </div>
      <div class="${pestana === "vehiculos" ? "" : "oculto"}">
        <div class="vehiculos">
          ${vehiculos.map((v) => `
            <a class="vehiculo-tarjeta" href="vehiculo.html?id=${v.id}">
              ${placa(v.matricula)}
              <strong>${escapar(v.marca)} ${escapar(v.modelo)}</strong>
              <span class="tenue">${v.anio} · ${entero(v.kilometraje)} km</span>
            </a>`).join("")}
          <button type="button" class="vehiculo-tarjeta vehiculo-tarjeta--nuevo" data-nuevo-vehiculo>${icono("mas")}<span>Agregar vehículo</span></button>
        </div>
      </div>
      <div class="${pestana === "historial" ? "" : "oculto"}">
        ${ordenes.map((o) => `
          <a class="fila" href="orden.html?id=${o.id}">
            ${placa(o.expand?.vehiculo?.matricula)}
            <div class="fila__cuerpo"><div class="fila__titulo">${escapar(o.problema)}</div><div class="fila__sub">${fecha(o.fecha_entrada)} · ${dinero(o.total)}</div></div>
            <div class="fila__fin">${estado(o.estado)}${o.saldo > 0 && o.estado !== "cancelada" ? `<div class="deuda">${dinero(o.saldo)}</div>` : ""}</div>
          </a>`).join("") || vacio("Todavía no hay órdenes.", "orden")}
      </div>
    </section>`
}

const cargarDetalle = async () => {
  const panel = $("#detalle-cliente")
  $("#dividido").classList.toggle("dividido--detalle", Boolean(seleccionado))
  if (!seleccionado) {
    panel.innerHTML = `<div class="bloque detalle-vacio"><div>${icono("clientes")}<p>Elija un cliente para ver sus vehículos, su historial y lo que debe.</p></div></div>`
    return
  }
  if (!detalle) panel.innerHTML = cargando(4)
  try {
    const filtro = pb.filter("cliente = {:c}", { c: seleccionado })
    const [cliente, vehiculos, ordenes] = await Promise.all([
      pb.collection("clientes").getOne(seleccionado),
      pb.collection("vehiculos").getFullList({ filter: filtro, sort: "matricula" }),
      pb.collection("ordenes").getFullList({ filter: filtro, sort: "-fecha_entrada", expand: "vehiculo" }),
    ])
    detalle = { cliente, vehiculos, ordenes }
    document.title = `${cliente.nombre} · El Pistón`
    pintarDetalle()
  } catch (error) {
    panel.innerHTML = `<div class="bloque">${vacio(error.status === 404 ? "El cliente no existe." : mensajeError(error), "alerta")}</div>`
  }
}

const seleccionar = (id) => {
  seleccionado = id
  detalle = null
  pestana = "vehiculos"
  history.pushState(null, "", id ? `clientes.html?id=${id}` : "clientes.html")
  $$("[data-cliente]").forEach((f) => f.classList.toggle("fila--seleccionada", f.dataset.cliente === id))
  cargarDetalle()
  window.scrollTo({ top: 0 })
}

const prepararHojasPagina = () => {
  $("#hojas-clientes").innerHTML =
    hoja({ id: "hoja-cliente", titulo: "Nuevo cliente", cuerpo: CAMPOS_CLIENTE, pie: pieGuardar() }) +
    hoja({ id: "hoja-vehiculo", titulo: "Nuevo vehículo", cuerpo: CAMPOS_VEHICULO, pie: pieGuardar("Guardar vehículo") })
  prepararHojas()
  alEnviar($("#hoja-cliente form"), async (datos) => {
    const editando = $("#hoja-cliente").dataset.editando
    const cliente = await guardarCliente(datos, editando)
    cerrarHoja($("#hoja-cliente"))
    aviso(editando ? "Cliente actualizado" : "Cliente registrado. Agregue su vehículo.")
    await cargarLista($("#buscar-cliente").value.trim())
    if (editando) {
      await cargarDetalle()
    } else {
      seleccionar(cliente.id)
      abrirHoja($("#hoja-vehiculo"))
    }
  })
  alEnviar($("#hoja-vehiculo form"), async (datos) => {
    const vehiculo = await guardarVehiculo({ ...datos, cliente: seleccionado })
    cerrarHoja($("#hoja-vehiculo"))
    aviso(`Vehículo ${vehiculo.matricula} registrado`)
    await Promise.all([cargarDetalle(), cargarLista($("#buscar-cliente").value.trim())])
  })
}

const abrirNuevoCliente = () => {
  const h = $("#hoja-cliente")
  delete h.dataset.editando
  $("#hoja-cliente-titulo").textContent = "Nuevo cliente"
  abrirHoja(h)
}

const conectar = () => {
  $("#buscar-cliente").addEventListener("input", retrasar((e) => cargarLista(e.target.value.trim()), 250))
  $("#boton-nuevo-cliente").addEventListener("click", abrirNuevoCliente)
  $("#lista-clientes").addEventListener("click", (evento) => {
    const fila = evento.target.closest("[data-cliente]")
    if (!fila || evento.ctrlKey || evento.metaKey) return
    evento.preventDefault()
    seleccionar(fila.dataset.cliente)
  })
  $("#detalle-cliente").addEventListener("click", (evento) => {
    if (evento.target.closest("[data-volver]")) {
      evento.preventDefault()
      seleccionar(null)
    }
    const tab = evento.target.closest("[data-pestana-cliente]")
    if (tab) {
      pestana = tab.dataset.pestanaCliente
      pintarDetalle()
    }
    if (evento.target.closest("[data-nuevo-vehiculo]")) abrirHoja($("#hoja-vehiculo"))
    if (evento.target.closest("[data-editar-cliente]")) {
      const h = $("#hoja-cliente")
      h.dataset.editando = detalle.cliente.id
      $("#hoja-cliente-titulo").textContent = "Editar cliente"
      abrirHoja(h)
      rellenarFormulario($("#hoja-cliente form"), detalle.cliente)
    }
  })
  window.addEventListener("popstate", () => {
    seleccionado = new URLSearchParams(location.search).get("id")
    detalle = null
    pintarLista()
    cargarDetalle()
  })
}

const usuario = await iniciarPagina("clientes")

if (usuario) {
  if (!esPersonal()) {
    location.replace("index.html")
  } else {
    prepararHojasPagina()
    conectar()
    await Promise.all([cargarLista(), cargarDetalle()])
    if (new URLSearchParams(location.search).get("nuevo")) abrirNuevoCliente()
    suscribir("ordenes", retrasar(() => seleccionado && cargarDetalle(), 500))
  }
}
