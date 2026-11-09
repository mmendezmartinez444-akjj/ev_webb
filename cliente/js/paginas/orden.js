import { pb, esDueno, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { moverOrden, puedeEditarOrden, puedeMover } from "../flujo.js"
import { icono } from "../iconos.js"
import {
  $, $$, ESTADOS, abrirHoja, alEnviar, aviso, cerrarHoja, conCarga, confirmar, dinero, entero, escapar, estaCerrada,
  estado, fechaHora, hace, parametro, placa, retrasar, segmentos, vacio,
} from "../ui.js"

const ordenId = parametro("id")
const PASOS = ["recibida", "diagnostico", "reparacion", "lista", "entregada"]
const ctx = { orden: null, trabajos: [], usados: [], pagos: [], inventario: [], mecanicos: [], pestana: "trabajos" }

const pintarHeroe = () => {
  const { orden, mecanicos } = ctx
  const v = orden.expand?.vehiculo
  const c = orden.expand?.cliente
  const editable = puedeEditarOrden(orden)
  const actual = PASOS.indexOf(orden.estado)
  document.title = `${v?.matricula ?? "Orden"} · El Pistón`
  const mecanico = esPersonal() && editable
    ? `<select class="entrada" id="cambiar-mecanico" aria-label="Mecánico asignado">${mecanicos.map((m) => `<option value="${m.id}" ${m.id === orden.mecanico ? "selected" : ""}>${escapar(m.name)}</option>`).join("")}</select>`
    : escapar(orden.expand?.mecanico?.name)
  $("#heroe").innerHTML = `
    <div class="heroe__arriba">
      <div class="heroe__identidad">
        ${placa(v?.matricula, true)}
        <div>
          <h1>${escapar(v?.marca)} ${escapar(v?.modelo)} <span class="tenue">${v?.anio ?? ""}</span></h1>
          <div class="tenue">Entró ${hace(orden.fecha_entrada)} · ${fechaHora(orden.fecha_entrada)}</div>
        </div>
      </div>
      <div class="herramientas sin-margen">
        ${estado(orden.estado)}
        ${esPersonal() && editable ? '<button type="button" class="boton boton--texto boton--chico" data-estado="cancelada">Cancelar orden</button>' : ""}
      </div>
    </div>
    ${orden.estado === "cancelada" ? "" : `
    <ol class="pasos" aria-label="Avance de la orden">
      ${PASOS.map((p, i) => `<li><button type="button" class="paso ${i < actual ? "paso--hecho" : ""} ${i === actual ? "paso--actual" : ""}" data-estado="${p}" ${puedeMover(orden, p) ? "" : "disabled"} ${i === actual ? 'aria-current="step"' : ""}>
        <span class="paso__barra"></span><span class="paso__texto">${ESTADOS[p].corto}</span></button></li>`).join("")}
    </ol>`}
    <dl class="heroe__datos">
      <div><dt class="etiqueta">Cliente</dt><dd>${esPersonal() ? `<a href="clientes.html?id=${c?.id}">${escapar(c?.nombre)}</a>` : escapar(c?.nombre)}</dd></div>
      <div><dt class="etiqueta">Teléfono</dt><dd><a href="tel:${escapar(c?.telefono)}">${escapar(c?.telefono)}</a></dd></div>
      <div><dt class="etiqueta">Mecánico</dt><dd>${mecanico}</dd></div>
      <div><dt class="etiqueta">Kilometraje</dt><dd>${orden.kilometraje ? `${entero(orden.kilometraje)} km` : "—"}</dd></div>
    </dl>
    <div class="heroe__problema"><div class="etiqueta">Problema reportado</div>${escapar(orden.problema)}</div>
    ${estaCerrada(orden.estado) ? `<div class="alerta alerta--info">${icono("check")}<div class="alerta__texto">${orden.estado === "entregada" ? `Entregada el ${fechaHora(orden.fecha_entrega)}. Solo admite cobros pendientes.` : "Orden cancelada. No admite cambios."}</div></div>` : ""}
    ${!estaCerrada(orden.estado) && !editable ? `<div class="alerta alerta--aviso">${icono("alerta")}<div class="alerta__texto">Asignada a otro mecánico: solo lectura.</div></div>` : ""}`
}

const linea = ({ icono: nombre, titulo, sub, monto, quitar }) => `
  <div class="linea">
    <span class="linea__icono">${icono(nombre)}</span>
    <div class="linea__cuerpo"><div class="fila__titulo">${titulo}</div><div class="fila__sub">${sub}</div></div>
    <span class="linea__monto">${monto}</span>
    ${quitar ? `<button type="button" class="quitar" data-quitar="${quitar.coleccion}" data-id="${quitar.id}" aria-label="Quitar">${icono("papelera")}</button>` : ""}
  </div>`

const pintarTrabajos = () => {
  const editable = puedeEditarOrden(ctx.orden)
  $("#formulario-trabajo").classList.toggle("oculto", !editable)
  $("#contador-trabajos").textContent = ctx.trabajos.length
  $("#lista-trabajos").innerHTML = ctx.trabajos.map((t) => linea({
    icono: "llave", titulo: escapar(t.descripcion), sub: hace(t.created), monto: dinero(t.precio),
    quitar: editable ? { coleccion: "trabajos", id: t.id } : null,
  })).join("") || vacio("Aún no se han anotado trabajos.", "llave")
}

const pintarRepuestos = () => {
  const editable = puedeEditarOrden(ctx.orden)
  $("#boton-usar-repuesto").classList.toggle("oculto", !editable)
  $("#contador-repuestos").textContent = ctx.usados.length
  $("#lista-repuestos").innerHTML = ctx.usados.map((u) => linea({
    icono: "caja", titulo: escapar(u.expand?.repuesto?.nombre),
    sub: `${entero(u.cantidad)} × ${dinero(u.precio_unitario)} · ${escapar(u.expand?.repuesto?.codigo)}`,
    monto: dinero(u.cantidad * u.precio_unitario),
    quitar: editable ? { coleccion: "orden_repuestos", id: u.id } : null,
  })).join("") || vacio("No se han usado repuestos.", "caja")
}

const pintarPagos = () => {
  if (!esPersonal()) return
  $("#pestana-pagos").classList.remove("oculto")
  $("#contador-pagos").textContent = ctx.pagos.length
  $("#lista-pagos").innerHTML = ctx.pagos.map((p) => linea({
    icono: "dinero", titulo: p.metodo === "efectivo" ? "Efectivo" : "Transferencia",
    sub: `${fechaHora(p.created)}${p.nota ? ` · ${escapar(p.nota)}` : ""}`, monto: dinero(p.monto),
    quitar: esDueno() ? { coleccion: "pagos", id: p.id } : null,
  })).join("") || vacio("Sin cobros registrados.", "dinero")
}

const admiteCobro = () => esPersonal() && ctx.orden.estado !== "cancelada" && ctx.orden.saldo > 0

const pintarCuenta = () => {
  const { orden } = ctx
  const porcentaje = orden.total > 0 ? Math.min(100, Math.round((orden.pagado / orden.total) * 100)) : 0
  $("#cuenta").innerHTML = `
    <div class="bloque__titulo"><h2>Cuenta</h2><span class="etiqueta">${porcentaje}% cobrado</span></div>
    <dl>
      <div><dt>Mano de obra</dt><dd>${dinero(orden.total_mano_obra)}</dd></div>
      <div><dt>Repuestos</dt><dd>${dinero(orden.total_repuestos)}</dd></div>
      <div class="cuenta__total"><dt>Total</dt><dd>${dinero(orden.total)}</dd></div>
      <div><dt>Cobrado</dt><dd>${dinero(orden.pagado)}</dd></div>
      <div class="cuenta__saldo ${orden.saldo > 0 ? "cuenta__saldo--debe" : "cuenta__saldo--pagado"}"><dt>${orden.saldo > 0 ? "Pendiente" : "Al día"}</dt><dd>${dinero(orden.saldo)}</dd></div>
    </dl>
    <div class="medidor"><span style="width:${porcentaje}%"></span></div>
    ${admiteCobro() ? '<button type="button" class="boton boton--ok boton--ancho separado" data-cobrar>Registrar cobro</button>' : ""}
    ${orden.estado === "lista" && esPersonal() ? '<button type="button" class="boton boton--ancho separado" data-estado="entregada">Entregar vehículo</button>' : ""}`
  $("#barra-cobro").innerHTML = `
    <div><span class="etiqueta">${orden.saldo > 0 ? "Pendiente" : "Total"}</span><strong class="${orden.saldo > 0 ? "deuda" : ""}">${dinero(orden.saldo > 0 ? orden.saldo : orden.total)}</strong></div>
    ${admiteCobro() ? '<button type="button" class="boton boton--ok" data-cobrar>Cobrar</button>' : orden.estado === "lista" && esPersonal() ? '<button type="button" class="boton" data-estado="entregada">Entregar</button>' : `<span class="tenue">${escapar(ESTADOS[orden.estado].texto)}</span>`}`
}

const pintar = () => {
  pintarHeroe()
  pintarTrabajos()
  pintarRepuestos()
  pintarPagos()
  pintarCuenta()
}

const cargar = async () => {
  const filtro = pb.filter("orden = {:o}", { o: ordenId })
  const [orden, trabajos, usados, pagos] = await Promise.all([
    pb.collection("ordenes").getOne(ordenId, { expand: "vehiculo,cliente,mecanico" }),
    pb.collection("trabajos").getFullList({ filter: filtro, sort: "created" }),
    pb.collection("orden_repuestos").getFullList({ filter: filtro, sort: "created", expand: "repuesto" }),
    esPersonal() ? pb.collection("pagos").getFullList({ filter: filtro, sort: "created" }) : Promise.resolve([]),
  ])
  Object.assign(ctx, { orden, trabajos, usados, pagos })
  pintar()
}

const recargar = async () => {
  try {
    await cargar()
  } catch (error) {
    aviso(mensajeError(error), "error")
  }
}

const cambiarPestana = (nombre) => {
  ctx.pestana = nombre
  $$("[data-pestana]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pestana === nombre)))
  $$("[data-panel]").forEach((p) => p.classList.toggle("oculto", p.dataset.panel !== nombre))
}

const pintarOpcionesRepuesto = (texto = "") => {
  const q = texto.toLowerCase()
  const elegido = $("#hoja-repuesto [name=repuesto]").value
  const lista = ctx.inventario.filter((r) => !q || r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q))
  $("#opciones-repuesto").innerHTML = lista.map((r) => `
    <button type="button" class="resultado" data-repuesto="${r.id}" aria-selected="${r.id === elegido}" ${r.existencias === 0 ? "disabled" : ""}>
      <span class="resultado__icono">${icono("caja")}</span>
      <span class="resultado__cuerpo"><strong>${escapar(r.nombre)}</strong><br><small class="tenue">${escapar(r.codigo)} · ${r.existencias === 0 ? "agotado" : `${entero(r.existencias)} disponibles`}</small></span>
      <strong>${dinero(r.precio)}</strong>
    </button>`).join("") || vacio("No hay repuestos con ese nombre.", "caja")
}

const abrirRepuestos = async () => {
  const hoja = $("#hoja-repuesto")
  abrirHoja(hoja)
  $("#opciones-repuesto").innerHTML = '<div class="carga"></div>'
  try {
    ctx.inventario = await pb.collection("repuestos").getFullList({ sort: "nombre" })
    pintarOpcionesRepuesto()
  } catch (error) {
    $("#opciones-repuesto").innerHTML = vacio(mensajeError(error), "alerta")
  }
}

const abrirCobro = () => {
  const { saldo } = ctx.orden
  const hoja = $("#hoja-cobro")
  abrirHoja(hoja)
  $("#cobro-saldo").textContent = `Saldo pendiente: ${dinero(saldo)}`
  $("#cobro-monto").max = saldo
  $("#cobro-monto").value = saldo.toFixed(2)
  $("#cobro-rapido").innerHTML = [["Todo", saldo], ["Mitad", Math.round(saldo * 50) / 100]]
    .map(([t, v]) => `<button type="button" class="ficha" data-monto="${v.toFixed(2)}">${t}: ${dinero(v)}</button>`).join("")
  $$("#cobro-metodo .segmento").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valor === "efectivo")))
  hoja.querySelector("[name=metodo]").value = "efectivo"
  $("#cobro-monto").select()
}

const conectar = () => {
  $$("[data-pestana]").forEach((b) => b.addEventListener("click", () => cambiarPestana(b.dataset.pestana)))

  document.addEventListener("click", async (evento) => {
    const boton = evento.target.closest("button")
    if (!boton) return
    if (boton.dataset.estado && boton.closest("#heroe, #cuenta, #barra-cobro")) {
      await conCarga(boton, async () => {
        if (await moverOrden(ctx.orden, boton.dataset.estado)) await recargar()
      })
    }
    if (boton.hasAttribute("data-cobrar")) abrirCobro()
    if (boton.dataset.quitar) {
      const mensaje = boton.dataset.quitar === "orden_repuestos" ? "¿Quitar este repuesto? Volverá al inventario." : "¿Quitar este registro?"
      if (!(await confirmar(mensaje, "Quitar"))) return
      await conCarga(boton, async () => {
        try {
          await pb.collection(boton.dataset.quitar).delete(boton.dataset.id)
          aviso("Eliminado")
          await recargar()
        } catch (error) {
          aviso(mensajeError(error), "error")
        }
      })
    }
    if (boton.dataset.repuesto) {
      $("#hoja-repuesto [name=repuesto]").value = boton.dataset.repuesto
      const r = ctx.inventario.find((x) => x.id === boton.dataset.repuesto)
      $("#hoja-repuesto [name=cantidad]").max = r?.existencias ?? ""
      pintarOpcionesRepuesto($("#buscar-repuesto").value)
    }
    if (boton.dataset.monto) $("#cobro-monto").value = boton.dataset.monto
  })

  $("#heroe").addEventListener("change", async (evento) => {
    if (evento.target.id !== "cambiar-mecanico") return
    try {
      await pb.collection("ordenes").update(ordenId, { mecanico: evento.target.value })
      aviso("Mecánico reasignado")
      await recargar()
    } catch (error) {
      aviso(mensajeError(error), "error")
    }
  })

  alEnviar($("#formulario-trabajo"), async (datos) => {
    await pb.collection("trabajos").create({ orden: ordenId, descripcion: datos.descripcion.trim(), precio: Number(datos.precio) })
    $("#formulario-trabajo").reset()
    await recargar()
    $("#formulario-trabajo [name=descripcion]").focus()
  })

  $("#boton-usar-repuesto").addEventListener("click", abrirRepuestos)
  $("#buscar-repuesto").addEventListener("input", (e) => pintarOpcionesRepuesto(e.target.value))
  alEnviar($("#hoja-repuesto form"), async (datos) => {
    if (!datos.repuesto) throw new Error("Elija un repuesto de la lista.")
    await pb.collection("orden_repuestos").create({ orden: ordenId, repuesto: datos.repuesto, cantidad: Number(datos.cantidad) })
    cerrarHoja($("#hoja-repuesto"))
    $("#hoja-repuesto [name=repuesto]").value = ""
    aviso("Repuesto agregado y descontado del inventario")
    cambiarPestana("repuestos")
    await recargar()
  })

  segmentos($("#cobro-metodo"), (valor) => {
    $("#hoja-cobro [name=metodo]").value = valor
  })
  alEnviar($("#hoja-cobro form"), async (datos) => {
    await pb.collection("pagos").create({ orden: ordenId, monto: Number(datos.monto), metodo: datos.metodo, nota: datos.nota.trim() })
    cerrarHoja($("#hoja-cobro"))
    aviso(`Cobro de ${dinero(datos.monto)} registrado`)
    await recargar()
  })
}

const suscribirCambios = () => {
  const refrescar = retrasar(recargar, 400)
  suscribir("ordenes", refrescar, ordenId)
  for (const coleccion of ["trabajos", "orden_repuestos", "pagos"]) {
    suscribir(coleccion, ({ record }) => record.orden === ordenId && refrescar())
  }
}

const usuario = await iniciarPagina("tablero")

if (usuario) {
  if (!ordenId) {
    location.replace("ordenes.html")
  } else {
    try {
      ctx.mecanicos = await pb.collection("users").getFullList({ filter: 'rol = "mecanico"', sort: "name", fields: "id,name" })
      await cargar()
      conectar()
      suscribirCambios()
    } catch (error) {
      $("#heroe").innerHTML = vacio(error.status === 404 ? "La orden no existe." : mensajeError(error), "alerta")
    }
  }
}
