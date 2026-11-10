export const GLOSSARY: { term: string; definition: string; formula?: string }[] = [
  {
    term: "Clientes por semana",
    definition: "Clientes distintos atendidos en una semana (domingo a sábado). Un cliente con dos servicios en la misma semana cuenta una vez. Es la métrica principal del proyecto.",
    formula: "Clientes distintos con al menos un servicio realizado en la semana",
  },
  {
    term: "Clientes nuevos",
    definition: "Clientes cuyo primer servicio realizado cae en esa semana.",
  },
  {
    term: "Clientes recurrentes",
    definition: "Clientes atendidos en la semana que ya tenían al menos un servicio anterior.",
    formula: "Clientes por semana − clientes nuevos",
  },
  {
    term: "Promedio de 12 semanas",
    definition: "Promedio de las últimas 12 semanas completas antes del corte de datos. La semana en curso no se incluye porque está incompleta.",
  },
  {
    term: "Mezcla nuevos / recurrentes",
    definition: "Porcentaje que representan los clientes nuevos y los recurrentes dentro del total semanal.",
  },
  {
    term: "Meta semanal",
    definition: "Clientes por semana que se quieren alcanzar (100). Se reparte entre nuevos y recurrentes según la mezcla elegida.",
    formula: "Meta de nuevos = meta × % de nuevos · Meta de recurrentes = meta − meta de nuevos",
  },
  {
    term: "% de incremento",
    definition: "Cuánto debe crecer cada grupo para llegar a su meta, contra el promedio actual.",
    formula: "Meta ÷ promedio actual − 1",
  },
  {
    term: "% de cumplimiento",
    definition: "Avance de la última semana completa contra la meta.",
    formula: "Clientes de la semana ÷ meta",
  },
  {
    term: "CAC (costo de adquisición)",
    definition: "Cuánto cuesta en pauta conseguir cada cliente nuevo. Usa la inversión en marketing de la hoja KPI, que es global (no se puede separar por ciudad ni por servicio).",
    formula: "Inversión semanal promedio en marketing ÷ clientes nuevos por semana",
  },
  {
    term: "CAC objetivo",
    definition: "CAC necesario para llegar a la meta de clientes nuevos sin aumentar el presupuesto de pauta.",
    formula: "Inversión semanal actual ÷ meta de clientes nuevos",
  },
  {
    term: "ROAS (primer servicio)",
    definition: "Ingreso que generan los clientes nuevos en su primer servicio por cada dólar de pauta. Es una medida conservadora: no incluye las visitas siguientes de esos clientes.",
    formula: "Ingreso semanal de primeros servicios ÷ inversión semanal en marketing",
  },
  {
    term: "Agendados por adelantado",
    definition: "Clientes distintos que ya tienen un servicio agendado en las próximas semanas.",
  },
  {
    term: "Tamaño de casa",
    definition: "Agrupación por número de recámaras registrado en cada servicio.",
  },
  {
    term: "Familia de servicio",
    definition: "Agrupación de las 424 descripciones de servicio en familias (Standard, Por horas, Deep Clean, Move Out, Move In, Organizing, Comercial, Airbnb). Provisional hasta validar con Kiki's.",
  },
  {
    term: "Frecuencia",
    definition: "Semanal, quincenal, mensual o única, según la columna FREQ. \"Única\" (DND en el Excel) está por validar.",
  },
  {
    term: "Fuente",
    definition: "De dónde llegó el cliente, según su primera visita y el cruce con Thumbtack y Melissa.com. Provisional hasta validar con Kiki's.",
  },
];
