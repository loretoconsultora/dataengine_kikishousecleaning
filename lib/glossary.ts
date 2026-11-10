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
  {
    term: "Tasa de recompra",
    definition: "Porcentaje de clientes que contrataron al menos dos veces.",
    formula: "Clientes con 2+ servicios ÷ clientes totales",
  },
  {
    term: "Cohorte",
    definition: "Grupo de clientes que hizo su primer servicio en el mismo mes. Sirve para ver cuántos siguen contratando 1, 2, 3… meses después.",
  },
  {
    term: "Retención al mes k",
    definition: "Porcentaje de una cohorte que tuvo al menos un servicio k meses después de su primer mes. La curva es el promedio ponderado de todas las cohortes.",
  },
  {
    term: "Estado del cliente",
    definition: "Activo: servicio en los últimos 60 días o cita agendada. En riesgo: último servicio hace 61 a 120 días. Perdido: más de 120 días (coincide con la etiqueta 120day de GHL).",
  },
  {
    term: "Ingreso por cliente",
    definition: "Suma de lo cobrado a cada cliente desde febrero 2025, sin propinas. Es valor observado, no proyectado.",
  },
  {
    term: "Concentración del ingreso (Pareto)",
    definition: "Qué porcentaje del ingreso aporta el grupo de clientes que más compra.",
  },
  {
    term: "Margen de contribución",
    definition: "Lo que queda de las ventas después de pagar a las limpiadoras. El margen del periodo usa la nómina semanal de la hoja KPI; el margen por tamaño, frecuencia y ciudad usa el pago por servicio registrado de feb 2025 a mar 2026.",
    formula: "(Ventas − nómina de limpiadoras) ÷ ventas",
  },
  {
    term: "Margen por hora",
    definition: "Margen de un servicio dividido entre las horas estimadas para ese tamaño de casa en la lista de precios. Si baja en casas grandes, el precio no crece al ritmo del trabajo.",
    formula: "(Precio − pago a limpiadora) ÷ horas estimadas",
  },
  {
    term: "Densidad por ciudad",
    definition: "Servicios por semana en una ciudad. Más densidad significa rutas más cortas y más rentables.",
  },
  {
    term: "Índice estacional",
    definition: "Qué tan fuerte es un mes contra un mes normal. Se calcula dentro de cada año para no confundir el crecimiento del negocio con temporada, y excluye el mes de arranque (febrero 2025).",
    formula: "Promedio semanal de clientes del mes ÷ promedio semanal de ese año",
  },
  {
    term: "Crecimiento año contra año",
    definition: "Clientes por semana de 2026 contra los mismos meses de 2025. Solo meses con 3 o más semanas en ambos años.",
    formula: "Suma de promedios 2026 ÷ suma de promedios 2025 − 1",
  },
  {
    term: "Semana atípica",
    definition: "Semana con 25% más o menos clientes que el promedio de sus 4 semanas previas. Se valida con Kiki's si fue clima, festivo u otro evento.",
  },
  {
    term: "Limpiadoras activas",
    definition: "Limpiadoras distintas registradas en el Excel cada semana. Solo se usa el conteo; los nombres no salen del Excel.",
  },
  {
    term: "Horas de trabajo estimadas",
    definition: "Horas-persona por servicio: N limpiadoras × M horas si la descripción lo indica; si no, las horas de la lista de precios por recámaras y baños × el multiplicador del tipo de servicio (Standard 1, Deep Clean 1.5, Move Out/In 1.75).",
  },
  {
    term: "Costo por hora de trabajo",
    definition: "Nómina semanal de limpiadoras de la hoja KPI dividida entre las horas estimadas de la semana.",
    formula: "Nómina semanal ÷ horas estimadas",
  },
  {
    term: "Limpiadoras necesarias",
    definition: "Equipo necesario para una meta de clientes, con el mismo tiempo por cliente y las horas por limpiadora elegidas.",
    formula: "(Meta × horas por cliente) ÷ horas por limpiadora",
  },
];
