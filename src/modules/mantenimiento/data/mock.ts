// Seed mock del dominio Mantenimiento — reproduce el contenido del mockup del cliente.
// TODO(sprint0): reemplazar por datos de seed en la base de datos + fixtures de test.

import type {
  Actividad,
  BitacoraEntrada,
  EquipoRef,
  InsumoRef,
  Intervencion,
  Mecanico,
  OrdenTrabajo,
  Umbral,
} from '../types'

// ---------- Equipos (dominio Flota) ----------
// Datos de solo lectura — en producción llegan vía API del dominio Flota.

export const EQUIPOS: Record<string, EquipoRef> = {
  'EX-001': { id: 'EX-001', codigo: 'EX-001', tipo: 'Excavadora' },
  'CM-003': { id: 'CM-003', codigo: 'CM-003', tipo: 'Camión tolva' },
  'PE-004': { id: 'PE-004', codigo: 'PE-004', tipo: 'Perforadora' },
  'CG-002': { id: 'CG-002', codigo: 'CG-002', tipo: 'Cargador frontal' },
}

// ---------- Insumos (dominio Inventario) ----------
// Datos de solo lectura — en producción llegan vía API del dominio Inventario.

export const INSUMOS: Record<string, InsumoRef> = {
  'FIL-021': {
    id: 'FIL-021',
    codigo: 'FIL-021',
    nombre: 'Filtro de aceite',
    unidad: 'u',
    stock: 14,
    stockMinimo: 6,
  },
  'ACE-100': {
    id: 'ACE-100',
    codigo: 'ACE-100',
    nombre: 'Aceite hidráulico',
    unidad: 'L',
    stock: 120,
    stockMinimo: 40,
  },
  'ORG-008': {
    id: 'ORG-008',
    codigo: 'ORG-008',
    nombre: 'O-ring cilindro levante',
    unidad: 'u',
    stock: 6,
    stockMinimo: 4,
  },
}

// ---------- Mecánicos ----------

export const MECANICOS: Record<string, Mecanico> = {
  'L. Fuentes': { nombre: 'L. Fuentes', iniciales: 'LF' },
  'J. Muñoz': { nombre: 'J. Muñoz', iniciales: 'JM' },
  'R. Vidal': { nombre: 'R. Vidal', iniciales: 'RV' },
}

// ---------- Órdenes de trabajo ----------

export const ORDENES_MOCK: OrdenTrabajo[] = [
  {
    id: 'OT-0142',
    equipo: EQUIPOS['CM-003'],
    titulo: 'Frenos con baja respuesta — equipo fuera de servicio',
    estado: 'PENDIENTE',
    prioridad: 'CRITICA',
    tipo: 'CORRECTIVA',
    hora: '07:10',
    origen: 'HALLAZGO',
    origenDetalle: 'P. Soto',
    mecanico: MECANICOS['L. Fuentes'],
    tareas: [
      { id: 'OT-0142-1', texto: 'Medir espesor de balatas', hecha: false },
      { id: 'OT-0142-2', texto: 'Purgar circuito de frenos', hecha: false },
      { id: 'OT-0142-3', texto: 'Prueba de frenado en rampa', hecha: false },
    ],
  },
  {
    id: 'OT-0141',
    equipo: EQUIPOS['PE-004'],
    titulo: 'Fuga de aceite hidráulico en cilindro de levante',
    estado: 'EN_PROCESO',
    prioridad: 'ALTA',
    tipo: 'CORRECTIVA',
    hora: '08:25',
    origen: 'HALLAZGO',
    origenDetalle: 'J. Rojas',
    mecanico: MECANICOS['J. Muñoz'],
    tareas: [
      { id: 'OT-0141-1', texto: 'Aislar circuito hidráulico', hecha: true },
      { id: 'OT-0141-2', texto: 'Cambiar sello del cilindro', hecha: true },
      { id: 'OT-0141-3', texto: 'Reponer aceite y probar levante', hecha: false },
    ],
  },
  {
    id: 'OT-0139',
    equipo: EQUIPOS['EX-001'],
    titulo: 'Mantención 1.250 h — filtros, aceite y refrigerante',
    estado: 'EN_PROCESO',
    prioridad: 'MEDIA',
    tipo: 'PREVENTIVA',
    hora: '06:40',
    origen: 'PREVENTIVO',
    mecanico: MECANICOS['L. Fuentes'],
    tareas: [
      { id: 'OT-0139-1', texto: 'Cambio de filtro de aceite', hecha: true },
      { id: 'OT-0139-2', texto: 'Cambio de aceite motor', hecha: false },
      { id: 'OT-0139-3', texto: 'Revisar refrigerante', hecha: false },
      { id: 'OT-0139-4', texto: 'Engrase general', hecha: false },
    ],
  },
  {
    id: 'OT-0136',
    equipo: EQUIPOS['CG-002'],
    titulo: 'Cambio de mangueras hidráulicas del tercer tramo',
    estado: 'COMPLETADA',
    prioridad: 'BAJA',
    tipo: 'CORRECTIVA',
    hora: '3/8 · 18:05',
    origen: 'MANUAL',
    origenDetalle: 'Admin',
    mecanico: MECANICOS['R. Vidal'],
    tareas: [
      { id: 'OT-0136-1', texto: 'Retirar mangueras dañadas', hecha: true },
      { id: 'OT-0136-2', texto: 'Instalar mangueras nuevas', hecha: true },
      { id: 'OT-0136-3', texto: 'Purgar y verificar presión', hecha: true },
    ],
  },
]

// ---------- Bitácora / Intervención (OT-0141) ----------

export const INTERVENCION_MOCK: Intervencion = {
  id: 'INT-0141-01',
  ordenId: 'OT-0141',
  tipo: 'CORRECTIVA',
  detalle: '',
  horasHombre: 0,
  horometro: 712,
  cerrada: false,
  insumos: [
    { insumo: INSUMOS['FIL-021'], cantidad: 1 },
    { insumo: INSUMOS['ACE-100'], cantidad: 20 },
    { insumo: INSUMOS['ORG-008'], cantidad: 2 },
  ],
}

export const BITACORA_MOCK: BitacoraEntrada[] = [
  {
    id: 'BIT-01',
    fecha: '03/08 · 08:40',
    autor: 'J. Muñoz',
    tipo: 'CORRECTIVA',
    resumen: 'Se aisló el circuito hidráulico y se retiró el cilindro de levante para inspección.',
    soloLectura: true,
  },
  {
    id: 'BIT-02',
    fecha: '03/08 · 09:55',
    autor: 'J. Muñoz',
    tipo: 'CORRECTIVA',
    resumen: 'Cambio de sello del cilindro. Se usaron 2 u de O-ring ORG-008.',
    soloLectura: true,
  },
]

// ---------- Motor preventivo ----------

export const AVISO_PORCENTAJE = 85

export const UMBRALES_POR_TIPO: { tipo: string; horas: number }[] = [
  { tipo: 'Excavadora', horas: 250 },
  { tipo: 'Camión', horas: 500 },
  { tipo: 'Perforadora', horas: 200 },
]

export const UMBRALES_MOCK: Umbral[] = [
  {
    equipo: EQUIPOS['EX-001'],
    horasUltima: 1000,
    horasUmbral: 1250,
    horasActuales: 1204,
    plan: 'Mantención 250 h',
    otGenerada: 'OT-0139',
  },
  {
    equipo: EQUIPOS['CM-003'],
    horasUltima: 4000,
    horasUmbral: 4500,
    horasActuales: 4482,
    plan: 'Mantención 500 h',
  },
  {
    equipo: EQUIPOS['PE-004'],
    horasUltima: 600,
    horasUmbral: 800,
    horasActuales: 712,
    plan: 'Cambio de barra y filtros',
  },
  {
    equipo: EQUIPOS['CG-002'],
    horasUltima: 700,
    horasUmbral: 950,
    horasActuales: 800,
    plan: 'Mantención 250 h',
  },
]

// ---------- Actividades ----------

export const ACTIVIDADES_MOCK: Actividad[] = [
  {
    id: 'ACT-01',
    descripcion: 'Verificar torque de pernos de oruga en EX-001',
    origen: 'EQUIPO',
    referencia: 'EX-001',
    asignadoA: MECANICOS['L. Fuentes'],
    estado: 'PENDIENTE',
  },
  {
    id: 'ACT-02',
    descripcion: 'Reponer O-rings bajo stock mínimo en bodega',
    origen: 'HALLAZGO',
    referencia: 'ORG-008',
    asignadoA: MECANICOS['R. Vidal'],
    estado: 'COMPLETADA',
  },
  {
    id: 'ACT-03',
    descripcion: 'Inspeccionar frenos según hallazgo crítico',
    origen: 'HALLAZGO',
    referencia: 'CM-003',
    asignadoA: MECANICOS['J. Muñoz'],
    estado: 'PENDIENTE',
  },
]
