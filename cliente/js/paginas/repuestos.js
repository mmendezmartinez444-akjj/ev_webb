import { pb, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { CAMPOS_REPUESTO, pieGuardar } from "../formularios.js"
import { guardarRepuesto, rellenarFormulario } from "../registros.js"
import {
  $, $$, abrirHoja, alEnviar, aviso, cargando, cerrarHoja, dinero, entero, escapar, hoja, parametro, prepararHojas,
  retrasar, segmentos, vacio,
} from "../ui.js"

const vista = { texto: parametro("q") ?? "", filtro: parametro("vista") ?? "todos", orden: "nombre" }
let repuestos = []

const nivel = (r) => (r.existencias === 0 ? "agotado" : r.existencias <= r.stock_minimo ? "bajo" : r.existencias <= r.stock_minimo * 2 ? "justo" : "ok")

const tarjeta = (r) => {
  const n = nivel(r)
  const referencia = Math.max(r.stock_minimo * 3, r.existencias, 1)
  const etiquetas = { agotado: "Agotado", bajo: "Por agotarse", justo: "Justo", ok: "Suficiente" }
  return `
    <article class="repuesto ${n === "agotado" || n === "bajo" ? "repuesto--bajo" : ""}">
      <div class="tarjeta-orden__fila">
        <span class="etiqueta mono">${escapar(r.codigo)}</span>
        <span class="estado ${n === "ok" ? "estado--lista" : n === "justo" ? "estado--reparacion" : "estado--cancelada"}">${etiquetas[n]}</span>
      </div>
      <strong>${escapar(r.nombre)}</strong>
      <div class="repuesto__existencias"><strong>${entero(r.existencias)}</strong><span class="tenue">unidades · mínimo ${entero(r.stock_minimo)}</span></div>
      <div class="medidor ${n === "bajo" || n === "agotado" ? "medidor--bajo" : n === "justo" ? "medidor--justo" : ""}"><span style="width:${(r.existencias / referencia) * 100}%"></span></div>
      <div class="tarjeta-orden__fila"><span class="tenue">Precio</span><strong>${dinero(r.precio)}</strong></div>
      ${esPersonal() ? `<div class="repuesto__acciones">
        <button type="button" class="boton boton--sobrio boton--chico" data-entrada="${r.id}">+ Entrada</button>
        <button type="button" class="boton boton--texto boton--chico" data-editar="${r.id}">Editar</button>
      </div>` : ""}
    </article>`
}

const construirFiltro = () => {
  const partes = []
  if (vista.filtro === "bajos") partes.push("existencias <= stock_minimo")
  if (vista.filtro === "agotados") partes.push("existencias = 0")
  if (vista.texto) partes.push(pb.filter("(nombre ~ {:q} || codigo ~ {:q})", { q: vista.texto }))
  return partes.join(" && ")
}

const cargar = async () => {
  if (!repuestos.length) $("#rejilla-repuestos").innerHTML = cargando(3)
  try {
    const [lista, bajos, todos] = await Promise.all([
      pb.collection("repuestos").getFullList({ filter: construirFiltro(), sort: vista.orden }),
      pb.collection("repuestos").getList(1, 1, { filter: "existencias <= stock_minimo", fields: "id" }),
      pb.collection("repuestos").getList(1, 1, { fields: "id" }),
    ])
    repuestos = lista
    $("#resumen-inventario").textContent = `${entero(todos.totalItems)} repuestos · ${entero(bajos.totalItems)} por agotarse`
    $("#rejilla-repuestos").innerHTML = lista.map(tarjeta).join("") || vacio("No hay repuestos con ese filtro.", "caja")
  } catch (error) {
    $("#rejilla-repuestos").innerHTML = vacio(mensajeError(error), "alerta")
  }
}

const prepararHojasPagina = () => {
  $("#hojas-repuestos").innerHTML =
    hoja({ id: "hoja-repuesto", titulo: "Nuevo repuesto", cuerpo: CAMPOS_REPUESTO, pie: pieGuardar() }) +
    hoja({
      id: "hoja-entrada",
      titulo: "Entrada de mercancía",
      cuerpo: `<input type="hidden" name="id"><p class="tenue" id="entrada-detalle"></p>
        <label class="campo"><span>Unidades recibidas</span><input name="cantidad" type="number" required min="1" inputmode="numeric"></label>
        <div class="fichas">${[1, 5, 10, 20].map((n) => `<button type="button" class="ficha" data-sumar="${n}">+${n}</button>`).join("")}</div>`,
      pie: pieGuardar("Sumar al inventario"),
    })
  prepararHojas()
  alEnviar($("#hoja-repuesto form"), async (datos) => {
    await guardarRepuesto(datos, datos.id)
    cerrarHoja($("#hoja-repuesto"))
    aviso(datos.id ? "Repuesto actualizado" : "Repuesto agregado")
    await cargar()
  })
  alEnviar($("#hoja-entrada form"), async (datos) => {
    await pb.collection("repuestos").update(datos.id, { "existencias+": Number(datos.cantidad) })
    cerrarHoja($("#hoja-entrada"))
    aviso(`Se sumaron ${datos.cantidad} unidades`)
    await cargar()
  })
  $("#hoja-entrada").addEventListener("click", (evento) => {
    const ficha = evento.target.closest("[data-sumar]")
    if (!ficha) return
    const campo = $("#hoja-entrada [name=cantidad]")
    campo.value = Number(campo.value || 0) + Number(ficha.dataset.sumar)
  })
}

const conectar = () => {
  $("#buscar-repuesto").value = vista.texto
  $$("#vista-repuestos .segmento").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valor === vista.filtro)))
  $("#buscar-repuesto").addEventListener("input", retrasar((e) => {
    vista.texto = e.target.value.trim()
    cargar()
  }))
  segmentos($("#vista-repuestos"), (valor) => {
    vista.filtro = valor
    cargar()
  })
  $("#orden-repuestos").addEventListener("change", (e) => {
    vista.orden = e.target.value
    cargar()
  })
  $("#boton-nuevo-repuesto").addEventListener("click", () => {
    $("#hoja-repuesto-titulo").textContent = "Nuevo repuesto"
    abrirHoja($("#hoja-repuesto"))
    $("#hoja-repuesto [name=id]").value = ""
  })
  $("#rejilla-repuestos").addEventListener("click", (evento) => {
    const editar = evento.target.closest("[data-editar]")
    const entrada = evento.target.closest("[data-entrada]")
    if (editar) {
      const r = repuestos.find((x) => x.id === editar.dataset.editar)
      $("#hoja-repuesto-titulo").textContent = "Editar repuesto"
      abrirHoja($("#hoja-repuesto"))
      rellenarFormulario($("#hoja-repuesto form"), r)
    }
    if (entrada) {
      const r = repuestos.find((x) => x.id === entrada.dataset.entrada)
      abrirHoja($("#hoja-entrada"))
      $("#hoja-entrada [name=id]").value = r.id
      $("#entrada-detalle").textContent = `${r.nombre} · hay ${entero(r.existencias)} unidades`
    }
  })
}

const usuario = await iniciarPagina("repuestos")

if (usuario) {
  $("#boton-nuevo-repuesto").classList.toggle("oculto", !esPersonal())
  if (esPersonal()) prepararHojasPagina()
  conectar()
  await cargar()
  suscribir("repuestos", retrasar(cargar, 400))
}
