import { pb, contar, esMecanico, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { moverOrden, puedeMover } from "../flujo.js"
import { icono } from "../iconos.js"
import {
  $, ESTADOS, ESTADOS_ABIERTOS, FILTRO_ABIERTAS, avatar, conCarga, dinero, entero, escapar, estado, hace, placa,
  retrasar, vacio, cargando,
} from "../ui.js"

const PRIORIDAD = { lista: 0, reparacion: 1, diagnostico: 2, recibida: 3 }
let filtroPropio = ""
let cola = []

const seccion = async (contenedor, generar) => {
  if (!contenedor.innerHTML.trim()) contenedor.innerHTML = cargando(2)
  try {
    contenedor.innerHTML = await generar()
  } catch (error) {
    contenedor.innerHTML = `<div class="alerta alerta--peligro">${icono("alerta")}<div class="alerta__texto">${escapar(mensajeError(error))}</div></div>`
  }
}

const cifra = (etiqueta, valor, nota, enlace, variante = "") =>
  `<a class="cifra ${variante}" href="${enlace}"><span class="etiqueta">${etiqueta}</span><span class="cifra__valor">${valor}</span><span class="cifra__nota">${nota}</span></a>`

const pintarCifras = async () => {
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)
  const desde = inicioDia.toISOString().replace("T", " ")
  const [abiertas, listas, entradasHoy, stockBajo, saldos] = await Promise.all([
    contar("ordenes", FILTRO_ABIERTAS + filtroPropio),
    contar("ordenes", 'estado = "lista"' + filtroPropio),
    contar("ordenes", pb.filter("fecha_entrada >= {:desde}", { desde }) + filtroPropio),
    contar("repuestos", "existencias <= stock_minimo"),
    esPersonal() ? pb.collection("saldos_clientes").getFullList({ fields: "saldo" }) : Promise.resolve(null),
  ])
  $("#resumen-hoy").textContent = `${abiertas} ${abiertas === 1 ? "orden abierta" : "órdenes abiertas"}, ${listas} ${listas === 1 ? "lista" : "listas"} para entregar.`
  const tarjetas = [
    cifra(esMecanico() ? "Mis abiertas" : "Abiertas", entero(abiertas), "en el taller ahora", "ordenes.html", "cifra--acento"),
    cifra("Para entregar", entero(listas), "esperando al cliente", "ordenes.html", listas ? "cifra--ok" : ""),
    cifra("Entraron hoy", entero(entradasHoy), "órdenes nuevas", "ordenes.html"),
  ]
  if (saldos) {
    const total = saldos.reduce((suma, s) => suma + s.saldo, 0)
    tarjetas.push(cifra("Por cobrar", dinero(total), `${saldos.length} clientes`, "reportes.html", total > 0 ? "cifra--peligro" : ""))
  } else {
    tarjetas.push(cifra("Repuestos bajos", entero(stockBajo), "en o bajo el mínimo", "repuestos.html?vista=bajos", stockBajo ? "cifra--peligro" : ""))
  }
  return tarjetas.join("")
}

const pintarDistribucion = async () => {
  const conteos = await Promise.all(ESTADOS_ABIERTOS.map((e) => contar("ordenes", pb.filter("estado = {:e}", { e }) + filtroPropio)))
  const total = conteos.reduce((a, b) => a + b, 0)
  return `
    <div class="distribucion" role="img" aria-label="Distribución de órdenes abiertas por estado">
      ${ESTADOS_ABIERTOS.map((e, i) => `<span class="relleno--${e}" style="width:${total ? (conteos[i] / total) * 100 : 0}%"></span>`).join("")}
    </div>
    <div class="leyenda">
      ${ESTADOS_ABIERTOS.map((e, i) => `<a href="ordenes.html#${e}"><span class="estado estado--${e}">${ESTADOS[e].corto}</span><strong>${conteos[i]}</strong></a>`).join("")}
    </div>`
}

const filaCola = (orden) => {
  const siguiente = ESTADOS[orden.estado].siguiente
  const rapido = siguiente && siguiente !== "entregada" && puedeMover(orden, siguiente)
  return `
    <div class="fila fila--cola">
      ${placa(orden.expand?.vehiculo?.matricula)}
      <a class="fila__cuerpo" href="orden.html?id=${orden.id}">
        <div class="fila__titulo">${escapar(orden.expand?.vehiculo?.marca)} ${escapar(orden.expand?.vehiculo?.modelo)} · ${escapar(orden.expand?.cliente?.nombre)}</div>
        <div class="fila__sub">${escapar(orden.problema)}</div>
      </a>
      <div class="fila__fin">
        ${estado(orden.estado)}
        <div class="fila__sub">${hace(orden.fecha_entrada)}</div>
      </div>
      ${rapido ? `<button type="button" class="mover" data-avanzar="${orden.id}" title="Pasar a ${ESTADOS[siguiente].texto}">${ESTADOS[siguiente].corto} →</button>` : ""}
      ${orden.estado === "lista" && esPersonal() ? `<button type="button" class="mover" data-entregar="${orden.id}">Entregar</button>` : ""}
    </div>`
}

const pintarCola = async () => {
  cola = await pb.collection("ordenes").getFullList({
    filter: FILTRO_ABIERTAS + filtroPropio,
    sort: "fecha_entrada",
    expand: "vehiculo,cliente,mecanico",
  })
  cola.sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado])
  if (!cola.length) return vacio("No hay trabajo pendiente. ¡Taller al día!", "check")
  return cola.slice(0, 8).map(filaCola).join("")
}

const pintarAlertas = async () => {
  const limite = new Date(Date.now() - 3 * 86400000).toISOString().replace("T", " ")
  const [bajos, demoradas, saldos] = await Promise.all([
    pb.collection("repuestos").getFullList({ filter: "existencias <= stock_minimo", sort: "existencias" }),
    pb.collection("ordenes").getFullList({ filter: `${FILTRO_ABIERTAS} && ${pb.filter("fecha_entrada < {:limite}", { limite })}${filtroPropio}`, expand: "vehiculo" }),
    esPersonal() ? pb.collection("saldos_clientes").getList(1, 3, { sort: "-saldo" }) : Promise.resolve({ items: [] }),
  ])
  const alertas = [
    ...bajos.map((r) => `<a class="alerta ${r.existencias === 0 ? "alerta--peligro" : "alerta--aviso"}" href="repuestos.html?q=${encodeURIComponent(r.codigo)}">${icono("repuestos")}<div class="alerta__texto"><strong>${escapar(r.nombre)}</strong><span>${r.existencias === 0 ? "Agotado" : `Quedan ${r.existencias}`} · mínimo ${r.stock_minimo}</span></div></a>`),
    ...demoradas.map((o) => `<a class="alerta alerta--info" href="orden.html?id=${o.id}">${icono("reloj")}<div class="alerta__texto"><strong>${escapar(o.expand?.vehiculo?.matricula)} lleva ${hace(o.fecha_entrada).replace("hace ", "")} en el taller</strong><span>${ESTADOS[o.estado].texto}</span></div></a>`),
    ...saldos.items.map((s) => `<a class="alerta alerta--peligro" href="clientes.html?id=${s.id}">${icono("dinero")}<div class="alerta__texto"><strong>${escapar(s.nombre)} debe ${dinero(s.saldo)}</strong><span>${s.ordenes_pendientes} ${s.ordenes_pendientes === 1 ? "orden" : "órdenes"} con saldo</span></div></a>`),
  ]
  return alertas.join("") || vacio("Nada urgente por ahora.", "check")
}

const pintarEquipo = async () => {
  const equipo = await pb.collection("carga_mecanicos").getFullList({ sort: "-abiertas,nombre" })
  if (!equipo.length) return vacio("No hay mecánicos registrados.", "clientes")
  const maximo = Math.max(1, ...equipo.map((m) => m.abiertas))
  return equipo.map((m) => `
    <div class="fila">
      ${avatar(m.nombre)}
      <div class="fila__cuerpo">
        <div class="fila__titulo">${escapar(m.nombre)}</div>
        <div class="apilada" style="width:${Math.max(8, (m.abiertas / maximo) * 100)}%" role="img" aria-label="${m.abiertas} órdenes abiertas">
          <span class="relleno--recibida" style="flex:${m.recibidas}"></span>
          <span class="relleno--diagnostico" style="flex:${m.en_diagnostico}"></span>
          <span class="relleno--reparacion" style="flex:${m.en_reparacion}"></span>
          <span class="relleno--lista" style="flex:${m.listas}"></span>
        </div>
      </div>
      <strong>${m.abiertas}</strong>
    </div>`).join("")
}

const cargar = () => Promise.allSettled([
  seccion($("#cifras"), pintarCifras),
  seccion($("#distribucion"), pintarDistribucion),
  seccion($("#cola"), pintarCola),
  seccion($("#alertas"), pintarAlertas),
  seccion($("#equipo"), pintarEquipo),
])

const saludar = (usuario) => {
  const hora = new Date().getHours()
  const momento = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  $("#saludo").textContent = `${momento}, ${(usuario.name || "").split(" ")[0]}`
  $("#fecha-hoy").textContent = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
}

const usuario = await iniciarPagina("hoy")

if (usuario) {
  saludar(usuario)
  if (esMecanico()) {
    filtroPropio = pb.filter(" && mecanico = {:id}", { id: usuario.id })
    $("#titulo-cola").textContent = "Mi cola de trabajo"
  }
  $("#cola").addEventListener("click", async (evento) => {
    const boton = evento.target.closest("[data-avanzar], [data-entregar]")
    if (!boton) return
    const orden = cola.find((o) => o.id === (boton.dataset.avanzar || boton.dataset.entregar))
    const destino = boton.dataset.entregar ? "entregada" : ESTADOS[orden.estado].siguiente
    await conCarga(boton, async () => {
      if (await moverOrden(orden, destino)) await cargar()
    })
  })
  await cargar()
  suscribir("ordenes", retrasar(cargar, 500))
}
