export interface Curso {
  id: string;
  nome: string;
  vagas: number;
  vagasSolicitadas?: number; // ⚡ Adicionado aqui
}

export interface Estabelecimento {
  id?: string;
  nome: string;
  cnes: string;
  cursos: Curso[];
}

export interface Municipio {
  nome: string;
  ibge: string;
  estabelecimentos: Estabelecimento[];
}

export interface EstadoRecurso {
  uf: string;
  nome: string;
  ibge: string;
  municipios: Municipio[];
}

export const estadosRecurso: EstadoRecurso[] = [
  {
    uf: "SP",
    ibge: "35",
    nome: "São Paulo",
    municipios: [
      {
        nome: "São Paulo",
        ibge: "3550308",
        estabelecimentos: [
          {
            cnes: "1234567",
            nome: "Hospital Central SP",
            cursos: [
              { id: "1", nome: "Aprimoramento Clínico", vagas: 5, vagasSolicitadas: 3 },
              { id: "2", nome: "Saúde Pública", vagas: 3, vagasSolicitadas: 1 },
            ],
          },
          {
            cnes: "1234568",
            nome: "Unidade Básica Saúde SP",
            cursos: [
              { id: "3", nome: "Medicina Preventiva", vagas: 4, vagasSolicitadas: 4 },
            ],
          },
        ],
      },
      {
        nome: "Campinas",
        ibge: "3509502",
        estabelecimentos: [
          {
            cnes: "2234567",
            nome: "Hospital Municipal Campinas",
            cursos: [
              { id: "4", nome: "Enfermagem Avançada", vagas: 2, vagasSolicitadas: 4 },
              { id: "5", nome: "Saúde Mental", vagas: 3, vagasSolicitadas: 1 },
            ],
          },
        ],
      },
    ],
  },
  {
    uf: "RJ",
    ibge: "33",
    nome: "Rio de Janeiro",
    municipios: [
      {
        nome: "Rio de Janeiro",
        ibge: "3304557",
        estabelecimentos: [
          {
            cnes: "3234567",
            nome: "Hospital Geral RJ",
            cursos: [
              { id: "6", nome: "Aprimoramento em Saúde Mental", vagas: 6, vagasSolicitadas: 4 },
              { id: "7", nome: "Gestão Hospitalar", vagas: 1, vagasSolicitadas: 4 },
            ],
          },
          {
            cnes: "3234568",
            nome: "UBS Copacabana",
            cursos: [
              { id: "8", nome: "Medicina Preventiva", vagas: 3, vagasSolicitadas: 4 },
            ],
          },
        ],
      },
      {
        nome: "Angra dos Reis",
        ibge: "3300100",
        estabelecimentos: [
          {
            cnes: "4234567",
            nome: "Hospital Angra",
            cursos: [
              { id: "9", nome: "Enfermagem Avançada", vagas: 2, vagasSolicitadas: 4 },
              { id: "10", nome: "Aprimoramento em Colposcopia", vagas: 4, vagasSolicitadas: 4 },
              { id: "11", nome: "Radioterapia SUS", vagas: 9, vagasSolicitadas: 4 },
            ],
          },
        ],
      },
      {
        nome: "São Gonçalo",
        ibge: "3304904",
        estabelecimentos: [
          {
            cnes: "5234567",
            nome: "UBS São Gonçalo",
            cursos: [
              { id: "12", nome: "Medicina Preventiva", vagas: 3, vagasSolicitadas: 4 },
            ],
          },
        ],
      },
      {
        nome: "Barra Mansa",
        ibge: "3300407",
        estabelecimentos: [
          {
            cnes: "6234567",
            nome: "Hospital Barra Mansa",
            cursos: [
              { id: "13", nome: "Saúde Pública", vagas: 4, vagasSolicitadas: 4 },
            ],
          },
        ],
      },
    ],
  },
];
