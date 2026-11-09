import { pb, esPersonal, mensajeError } from "./api.js"
import { icono } from "./iconos.js"
import { $, $$, ESTADOS, escapar, retrasar } from "./ui.js"

let dialogo = null
let opciones = []
let indice = 0
let consulta = 0

const ACCIONES = () => [
  ...(esPersonal() ? [{ icono: "mas", titulo: "Nueva orden de servicio", sub: "Atajo: N", accion: () => import("./asistente.js").then((m) => m.abrirAsistente()) }] : []),
  { icono: "tablero", titulo: "Ir al tablero de órdenes", sub: "Órdenes abiertas por estado", enlace: "ordenes.html" },
  { icono: "repuestos", titulo: "Ver repuestos por agotarse", sub: "Inventario", enlace: "repuestos.html?vista=bajos" },
  ...(esPersonal() ? [
    { icono: "clientes", titulo: "Registrar cliente", sub: "Clientes", enlace: "clientes.html?nuevo=1" },
    { icono: "reportes", titulo: "Ver reportes", sub: "Facturación, saldos y carga", enlace: "reportes.html" },
  ] : []),
]

const crear = () => {
  const contenedor = document.createElement("div")
  contenedor.innerHTML = `
    <dialog class="paleta" aria-label="Búsqueda global">
      <div class="paleta__entrada">
        ${icono("buscar")}
        <input type="search" placeholder="Matrícula, cliente, teléfono o repuesto…" aria-label="Buscar" autocomplete="off">
        <kbd>Esc</kbd>
      </div>
      <div class="paleta__resultados" role="listbox"></div>
      <div class="paleta__pie"><span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span><span><kbd>Enter</kbd> abrir</span><span><kbd>/</kbd> o <kbd>Ctrl K</kbd> buscar</span></div>
    </dialog>`
  dialogo = contenedor.firstElementChild
  document.body.append(dialogo)
  const entrada = $("input", dialogo)
  entrada.addEventListener("input", retrasar(() => buscar(entrada.value.trim()), 220))
  entrada.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault()
      seleccionar(indice + (evento.key === "ArrowDown" ? 1 : -1))
    } else if (evento.key === "Escape") {
      evento.preventDefault()
      dialogo.close()
    } else if (evento.key === "Enter") {
      evento.preventDefault()
      ejecutar(opciones[indice])
    }
  })
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close()
    const boton = evento.target.closest("[data-indice]")
    if (boton) ejecutar(opciones[Number(boton.dataset.indice)])
  })
}

const seleccionar = (nuevo) => {
  if (!opciones.length) return
  indice = (nuevo + opciones.length) % opciones.length
  $$("[data-indice]", dialogo).forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.indice) === indice)))
  $(`[data-indice="${indice}"]`, dialogo)?.scrollIntoView({ block: "nearest" })
}

const ejecutar = (opcion) => {
  if (!opcion) return
  dialogo.close()
  if (opcion.enlace) location.href = opcion.enlace
  else opcion.accion?.()
}

const pintar = (grupos) => {
  opciones = []
  const html = grupos.filter((g) => g.items.length).map((grupo) => `
    <div class="paleta__grupo etiqueta">${grupo.titulo}</div>
    ${grupo.items.map((item) => {
      opciones.push(item)
      return `<button type="button" class="resultado" role="option" data-indice="${opciones.length - 1}">
        <span class="resultado__icono">${icono(item.icono)}</span>
        <span class="resultado__cuerpo"><strong>${escapar(item.titulo)}</strong><br><small class="tenue">${escapar(item.sub ?? "")}</small></span>
      </button>`
    }).join("")}`).join("")
  $(".paleta__resultados", dialogo).innerHTML = html || '<p class="vacio">Sin resultados</p>'
  seleccionar(0)
}

const buscar = async (texto) => {
  const numero = ++consulta
  if (texto.length < 2) {
    pintar([{ titulo: "Acciones", items: ACCIONES() }])
    return
  }
  const q = { q: texto }
  try {
    const [ordenes, vehiculos, clientes, repuestos] = await Promise.all([
      pb.collection("ordenes").getList(1, 5, {
        filter: pb.filter("vehiculo.matricula ~ {:q} || cliente.nombre ~ {:q}", q),
        sort: "-fecha_entrada",
        expand: "vehiculo,cliente",
      }),
      esPersonal() ? pb.collection("vehiculos").getList(1, 4, { filter: pb.filter("matricula ~ {:q} || marca ~ {:q} || modelo ~ {:q}", q), expand: "cliente" }) : { items: [] },
      esPersonal() ? pb.collection("clientes").getList(1, 4, { filter: pb.filter("nombre ~ {:q} || telefono ~ {:q}", q) }) : { items: [] },
      pb.collection("repuestos").getList(1, 4, { filter: pb.filter("nombre ~ {:q} || codigo ~ {:q}", q) }),
    ])
    if (numero !== consulta) return
    pintar([
      { titulo: "Órdenes", items: ordenes.items.map((o) => ({ icono: "orden", titulo: `${o.expand?.vehiculo?.matricula} · ${o.expand?.cliente?.nombre}`, sub: `${ESTADOS[o.estado].texto} · ${o.problema}`, enlace: `orden.html?id=${o.id}` })) },
      { titulo: "Vehículos", items: vehiculos.items.map((v) => ({ icono: "coche", titulo: `${v.matricula} · ${v.marca} ${v.modelo}`, sub: v.expand?.cliente?.nombre, enlace: `vehiculo.html?id=${v.id}` })) },
      { titulo: "Clientes", items: clientes.items.map((c) => ({ icono: "clientes", titulo: c.nombre, sub: c.telefono, enlace: `clientes.html?id=${c.id}` })) },
      { titulo: "Repuestos", items: repuestos.items.map((r) => ({ icono: "repuestos", titulo: r.nombre, sub: `${r.codigo} · ${r.existencias} en existencia`, enlace: `repuestos.html?q=${encodeURIComponent(r.codigo)}` })) },
    ])
  } catch (error) {
    if (numero === consulta) $(".paleta__resultados", dialogo).innerHTML = `<p class="vacio">${escapar(mensajeError(error))}</p>`
  }
}

export const abrirPaleta = () => {
  if (!dialogo) crear()
  if (dialogo.open) return
  const entrada = $("input", dialogo)
  entrada.value = ""
  buscar("")
  dialogo.showModal()
  entrada.focus()
}
