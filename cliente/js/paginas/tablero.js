import { pb, esMecanico, esPersonal, mensajeError, suscribir } from "../api.js"
import { POR_PAGINA } from "../config.js"
import { iniciarPagina } from "../plantilla.js"
import { moverOrden, puedeMover } from "../flujo.js"
import {
  $, $$, ESTADOS, ESTADOS_ABIERTOS, FILTRO_ABIERTAS, avatar, cargando, dinero, entero, escapar, estado, fecha, hace,
  placa, retrasar, segmentos, vacio,
} from "../ui.js"

const vista = { modo: "tablero", texto: "", mecanico: "", historial: "entregada", pagina: 1 }
let ordenes = []
let entregadasHoy = []
let mecanicos = []
let arrastrada = null

const coincide = (orden) => {
  if (vista.mecanico && orden.mecanico !== vista.mecanico) return false
  if (!vista.texto) return true
  const q = vista.texto.toLowerCase()
  return [orden.expand?.vehiculo?.matricula, orden.expand?.cliente?.nombre, orden.expand?.vehiculo?.marca]
    .some((v) => String(v ?? "").toLowerCase().includes(q))
}

const tarjeta = (orden) => {
  const siguiente = ESTADOS[orden.estado].siguiente
  const rapido = siguiente && puedeMover(orden, siguiente)
  const movible = ESTADOS_ABIERTOS.some((e) => puedeMover(orden, e))
  return `
    <article class="tarjeta-orden" draggable="${movible}" data-id="${orden.id}">
      <div class="tarjeta-orden__fila">
        ${placa(orden.expand?.vehiculo?.matricula)}
        ${orden.saldo > 0 && orden.total > 0 ? `<span class="deuda" title="Saldo pendiente">${dinero(orden.saldo)}</span>` : ""}
      </div>
      <a href="orden.html?id=${orden.id}" class="tarjeta-orden__vehiculo" draggable="false">${escapar(orden.expand?.vehiculo?.marca)} ${escapar(orden.expand?.vehiculo?.modelo)}</a>
      <p class="tarjeta-orden__problema">${escapar(orden.problema)}</p>
      <div class="tarjeta-orden__pie">
        <span>${escapar(orden.expand?.cliente?.nombre)} · ${hace(orden.fecha_entrada)}</span>
        ${avatar(orden.expand?.mecanico?.name, "avatar--chico")}
      </div>
      ${rapido ? `<button type="button" class="mover" data-mover="${siguiente}">${siguiente === "entregada" ? "Entregar" : `${ESTADOS[siguiente].corto} →`}</button>` : ""}
    </article>`
}

const pintarTablero = () => {
  const visibles = ordenes.filter(coincide)
  const columnas = ESTADOS_ABIERTOS.map((e) => ({ id: e, titulo: ESTADOS[e].texto, corto: ESTADOS[e].corto, items: visibles.filter((o) => o.estado === e) }))
  if (esPersonal()) columnas.push({ id: "entregada", titulo: "Entregadas hoy", corto: "Entregadas", items: entregadasHoy.filter(coincide) })
  $("#saltos").innerHTML = columnas.map((c) => `<a class="ficha" href="#${c.id}" data-salto="${c.id}">${c.corto} · ${c.items.length}</a>`).join("")
  $("#tablero").innerHTML = columnas.map((c) => `
    <section class="columna" data-columna="${c.id}" id="${c.id}" aria-label="${c.titulo}">
      <header class="columna__cabecera">
        <span class="estado estado--${c.id}">${c.titulo}</span>
        <span class="columna__contador">${c.items.length}</span>
      </header>
      <div class="columna__tarjetas">
        ${c.items.map(tarjeta).join("") || `<p class="columna__vacia">${c.id === "entregada" ? "Suelte aquí para entregar" : "Sin órdenes"}</p>`}
      </div>
    </section>`).join("")
  $("#resumen-tablero").textContent = `${visibles.length} órdenes abiertas · arrastre una tarjeta o use su botón para cambiar el estado`
}

const pintarMecanicos = () => {
  const opciones = [{ id: "", name: "Todos" }, ...mecanicos]
  $("#filtro-mecanico").innerHTML = opciones.map((m) => `
    <button type="button" class="ficha" data-mecanico="${m.id}" aria-pressed="${vista.mecanico === m.id}">${m.id && m.id === pb.authStore.record.id ? "Mías" : escapar(m.name)}</button>`).join("")
}

const cargarTablero = async () => {
  if (!ordenes.length) $("#tablero").innerHTML = cargando(4)
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  try {
    const [abiertas, hoy] = await Promise.all([
      pb.collection("ordenes").getFullList({ filter: FILTRO_ABIERTAS, sort: "fecha_entrada", expand: "vehiculo,cliente,mecanico" }),
      esPersonal()
        ? pb.collection("ordenes").getFullList({ filter: pb.filter('estado = "entregada" && fecha_entrega >= {:inicio}', { inicio: inicio.toISOString().replace("T", " ") }), expand: "vehiculo,cliente,mecanico" })
        : Promise.resolve([]),
    ])
    ordenes = abiertas
    entregadasHoy = hoy
    pintarTablero()
  } catch (error) {
    $("#tablero").innerHTML = `<div class="bloque">${vacio(mensajeError(error), "alerta")}</div>`
  }
}

const cargarHistorial = async () => {
  const contenedor = $("#historial")
  contenedor.innerHTML = cargando(4)
  const partes = [vista.historial === "todas" ? '(estado = "entregada" || estado = "cancelada")' : pb.filter("estado = {:e}", { e: vista.historial })]
  if (vista.mecanico) partes.push(pb.filter("mecanico = {:m}", { m: vista.mecanico }))
  if (vista.texto) partes.push(pb.filter("(vehiculo.matricula ~ {:q} || cliente.nombre ~ {:q})", { q: vista.texto }))
  try {
    const resultado = await pb.collection("ordenes").getList(vista.pagina, POR_PAGINA, {
      filter: partes.join(" && "),
      sort: "-fecha_entrada",
      expand: "vehiculo,cliente,mecanico",
    })
    contenedor.innerHTML = resultado.items.length === 0 ? vacio("No hay órdenes en el historial con esos filtros.", "orden") : `
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Vehículo</th><th>Cliente</th><th>Entrada</th><th>Entrega</th><th>Estado</th><th class="num">Total</th><th class="num">Saldo</th></tr></thead>
        <tbody>${resultado.items.map((o) => `
          <tr>
            <td><a href="orden.html?id=${o.id}">${placa(o.expand?.vehiculo?.matricula)}</a></td>
            <td>${escapar(o.expand?.cliente?.nombre)}</td>
            <td>${fecha(o.fecha_entrada)}</td>
            <td>${fecha(o.fecha_entrega)}</td>
            <td>${estado(o.estado)}</td>
            <td class="num">${dinero(o.total)}</td>
            <td class="num ${o.saldo > 0 && o.estado !== "cancelada" ? "deuda" : ""}">${dinero(o.saldo)}</td>
          </tr>`).join("")}</tbody>
      </table></div>`
    $("#historial-paginas").innerHTML = resultado.totalPages > 1 ? `
      <button type="button" class="boton boton--sobrio boton--chico" data-pagina="${resultado.page - 1}" ${resultado.page <= 1 ? "disabled" : ""}>Anterior</button>
      <span class="tenue">Página ${resultado.page} de ${resultado.totalPages} · ${entero(resultado.totalItems)} órdenes</span>
      <button type="button" class="boton boton--sobrio boton--chico" data-pagina="${resultado.page + 1}" ${resultado.page >= resultado.totalPages ? "disabled" : ""}>Siguiente</button>` : ""
  } catch (error) {
    contenedor.innerHTML = vacio(mensajeError(error), "alerta")
  }
}

const refrescar = () => (vista.modo === "tablero" ? pintarTablero() : cargarHistorial())

const soltar = async (orden, destino) => {
  if (!orden || orden.estado === destino) return
  if (!puedeMover(orden, destino)) {
    await moverOrden(orden, destino)
    return
  }
  const anterior = orden.estado
  if (destino !== "entregada") {
    orden.estado = destino
    pintarTablero()
  }
  const exito = await moverOrden({ ...orden, estado: anterior }, destino)
  if (!exito) orden.estado = anterior
  await cargarTablero()
}

const conectarArrastre = () => {
  const tablero = $("#tablero")
  tablero.addEventListener("dragstart", (evento) => {
    const tarjetaOrden = evento.target.closest(".tarjeta-orden")
    if (!tarjetaOrden) return
    arrastrada = ordenes.find((o) => o.id === tarjetaOrden.dataset.id)
    evento.dataTransfer.effectAllowed = "move"
    evento.dataTransfer.setData("text/plain", tarjetaOrden.dataset.id)
    tarjetaOrden.classList.add("tarjeta-orden--arrastrando")
  })
  tablero.addEventListener("dragend", (evento) => {
    evento.target.closest(".tarjeta-orden")?.classList.remove("tarjeta-orden--arrastrando")
    $$(".columna--sobre").forEach((c) => c.classList.remove("columna--sobre"))
  })
  tablero.addEventListener("dragover", (evento) => {
    const columna = evento.target.closest(".columna")
    if (!columna || !arrastrada || !puedeMover(arrastrada, columna.dataset.columna)) return
    evento.preventDefault()
    $$(".columna--sobre").forEach((c) => c !== columna && c.classList.remove("columna--sobre"))
    columna.classList.add("columna--sobre")
  })
  tablero.addEventListener("drop", (evento) => {
    const columna = evento.target.closest(".columna")
    if (!columna) return
    evento.preventDefault()
    columna.classList.remove("columna--sobre")
    const orden = arrastrada
    arrastrada = null
    soltar(orden, columna.dataset.columna)
  })
  tablero.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-mover]")
    if (boton) {
      evento.preventDefault()
      const orden = ordenes.find((o) => o.id === boton.closest(".tarjeta-orden").dataset.id)
      soltar(orden, boton.dataset.mover)
      return
    }
    const tarjetaOrden = evento.target.closest(".tarjeta-orden")
    if (tarjetaOrden && !evento.target.closest("a")) location.href = `orden.html?id=${tarjetaOrden.dataset.id}`
  })
}

const conectar = () => {
  segmentos($("#vista"), (modo) => {
    vista.modo = modo
    vista.pagina = 1
    $("#panel-tablero").classList.toggle("oculto", modo !== "tablero")
    $("#panel-historial").classList.toggle("oculto", modo !== "historial")
    refrescar()
  })
  segmentos($("#historial-estado"), (valor) => {
    vista.historial = valor
    vista.pagina = 1
    cargarHistorial()
  })
  $("#filtro-texto").addEventListener("input", retrasar((evento) => {
    vista.texto = evento.target.value.trim()
    vista.pagina = 1
    refrescar()
  }, 200))
  $("#filtro-mecanico").addEventListener("click", (evento) => {
    const ficha = evento.target.closest("[data-mecanico]")
    if (!ficha) return
    vista.mecanico = ficha.dataset.mecanico
    vista.pagina = 1
    pintarMecanicos()
    refrescar()
  })
  $("#historial-paginas").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-pagina]")
    if (!boton) return
    vista.pagina = Number(boton.dataset.pagina)
    cargarHistorial()
  })
  $("#saltos").addEventListener("click", (evento) => {
    const salto = evento.target.closest("[data-salto]")
    if (!salto) return
    evento.preventDefault()
    document.getElementById(salto.dataset.salto)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })
  })
  conectarArrastre()
}

const usuario = await iniciarPagina("tablero")

if (usuario) {
  if (esMecanico()) vista.mecanico = usuario.id
  try {
    mecanicos = await pb.collection("users").getFullList({ filter: 'rol = "mecanico"', sort: "name", fields: "id,name" })
  } catch (_) {
    mecanicos = []
  }
  pintarMecanicos()
  conectar()
  await cargarTablero()
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ inline: "start", block: "nearest" })
  suscribir("ordenes", retrasar(async () => {
    await cargarTablero()
    if (vista.modo === "historial") cargarHistorial()
  }, 400))
}
