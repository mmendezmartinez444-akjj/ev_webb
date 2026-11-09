import { pb, esPersonal, mensajeError, usuarioActual } from "./api.js"
import { ESTADOS, aviso, confirmar, dinero, estaCerrada } from "./ui.js"

export const puedeEditarOrden = (orden) =>
  !estaCerrada(orden.estado) && (esPersonal() || orden.mecanico === usuarioActual()?.id)

export const puedeMover = (orden, destino) => {
  if (!puedeEditarOrden(orden) || orden.estado === destino) return false
  if (destino === "entregada" || destino === "cancelada") return esPersonal()
  return true
}

export const moverOrden = async (orden, destino) => {
  if (!puedeMover(orden, destino)) {
    aviso(destino === "entregada" ? "Solo recepción o el dueño pueden entregar vehículos." : "No puede mover esta orden.", "error")
    return false
  }
  if (destino === "entregada") {
    const mensaje = orden.saldo > 0
      ? `El cliente todavía debe ${dinero(orden.saldo)}. ¿Entregar el vehículo de todas formas?`
      : "¿Confirmar la entrega del vehículo?"
    if (!(await confirmar(mensaje, "Entregar", false))) return false
  }
  if (destino === "cancelada" && !(await confirmar("¿Cancelar esta orden? Ya no se podrá modificar.", "Cancelar orden"))) return false
  try {
    await pb.collection("ordenes").update(orden.id, { estado: destino })
    aviso(`${ESTADOS[destino].texto}`)
    return true
  } catch (error) {
    aviso(mensajeError(error), "error")
    return false
  }
}
