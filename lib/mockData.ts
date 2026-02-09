import { 
  Plano, 
  Cliente, 
  Falecido,
  Service,
  ServiceCategory,
  Product,
  Atendimento,
  AccountReceivable,
  Payment,
  CashFlow,
  Venue,
  VenueBooking,
  Vehicle,
  OperationalTask,
  Cemetery,
  BurialPlot,
  Supplier,
  StockMovement
} from '../types';

export const mockPlanos: Plano[] = [
  {
    id: '1',
    codigo: 'PLN-00001',
    nome: 'Plano Individual Básico',
    descricao: 'Proteção essencial para você com cobertura funerária completa.',
    categoria: 'individual',
    status: 'ativo',
    valorMensal: 89.90,
    valorAnual: 899.00,
    taxaAdesao: 0,
    numeroMaximoBeneficiarios: 1,
    carenciaDias: 30,
    criadoEm: '2023-01-15',
    clientesAtivos: 145,
  },
  {
    id: '2',
    codigo: 'PLN-00002',
    nome: 'Plano Familiar Premium',
    descricao: 'Cobertura completa para toda família, incluindo translado.',
    categoria: 'familiar',
    status: 'ativo',
    valorMensal: 149.90,
    valorAnual: 1499.00,
    taxaAdesao: 0,
    numeroMaximoBeneficiarios: 5,
    carenciaDias: 30,
    criadoEm: '2023-02-20',
    clientesAtivos: 523,
  },
  {
    id: '3',
    codigo: 'PLN-00003',
    nome: 'Plano Empresarial Gold',
    descricao: 'Solução corporativa para empresas acima de 10 funcionários.',
    categoria: 'empresarial',
    status: 'inativo',
    valorMensal: 49.90, // por vida
    taxaAdesao: 100.00,
    numeroMaximoBeneficiarios: 100,
    carenciaDias: 0,
    criadoEm: '2023-03-10',
    clientesAtivos: 12,
  }
];

export const mockClientes: Cliente[] = [
  {
    id: '1',
    codigo: 'CLI-00001',
    nome: 'João Silva',
    cpf: '123.456.789-00',
    email: 'joao@email.com',
    telefone: '(11) 99999-9999',
    dataNascimento: '1980-01-15',
    endereco: {
      cep: '01001-000',
      logradouro: 'Praça da Sé',
      numero: '100',
      bairro: 'Sé',
      cidade: 'São Paulo',
      estado: 'SP'
    },
    planoId: '2',
    planoNome: 'Plano Familiar Premium',
    statusAssinatura: 'ativo',
    valorMensal: 149.90,
    periodicidade: 'mensal',
    diaVencimento: 10,
    formaPagamento: 'Cartão de Crédito',
    dataContratacao: '2023-06-15',
    proximoVencimento: '2024-06-10',
    criadoEm: '2023-06-15',
  },
  {
    id: '2',
    codigo: 'CLI-00002',
    nome: 'Maria Oliveira',
    cpf: '987.654.321-99',
    email: 'maria@email.com',
    telefone: '(21) 98888-8888',
    dataNascimento: '1992-05-20',
    endereco: {
      cep: '20040-002',
      logradouro: 'Rua Rio Branco',
      numero: '50',
      complemento: 'Apto 202',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      estado: 'RJ'
    },
    planoId: '1',
    planoNome: 'Plano Individual Básico',
    statusAssinatura: 'inadimplente',
    valorMensal: 89.90,
    periodicidade: 'mensal',
    diaVencimento: 5,
    formaPagamento: 'Boleto',
    dataContratacao: '2023-08-01',
    proximoVencimento: '2024-05-05',
    criadoEm: '2023-08-01',
  },
  {
    id: '3',
    codigo: 'CLI-00003',
    nome: 'Carlos Santos',
    cpf: '456.789.123-45',
    email: 'carlos@email.com',
    telefone: '(31) 97777-7777',
    dataNascimento: '1975-11-30',
    endereco: {
      cep: '30130-000',
      logradouro: 'Av. Afonso Pena',
      numero: '1000',
      bairro: 'Centro',
      cidade: 'Belo Horizonte',
      estado: 'MG'
    },
    planoId: '2',
    planoNome: 'Plano Familiar Premium',
    statusAssinatura: 'suspenso',
    valorMensal: 149.90,
    periodicidade: 'mensal',
    diaVencimento: 15,
    formaPagamento: 'PIX',
    dataContratacao: '2023-01-10',
    proximoVencimento: '2024-06-15',
    criadoEm: '2023-01-10',
  }
];

// ==================== FALECIDOS ====================
export const mockFalecidos: Falecido[] = [
  {
    id: '1',
    clientId: '1',
    nome: 'Ana Silva',
    cpf: '111.222.333-44',
    dataNascimento: '1950-03-20',
    dataFalecimento: '2024-01-15',
    horaFalecimento: '14:30',
    localFalecimento: 'Hospital São Paulo',
    causaMortis: 'Insuficiência cardíaca',
    medicoDeclarante: {
      nome: 'Dr. Carlos Mendes',
      crm: 'SP-123456'
    },
    certidaoObito: {
      numero: '12345',
      livro: 'A',
      folha: '100'
    },
    criadoEm: '2024-01-15'
  },
  {
    id: '2',
    clientId: '2',
    nome: 'Pedro Oliveira',
    cpf: '222.333.444-55',
    dataNascimento: '1945-07-10',
    dataFalecimento: '2024-01-20',
    horaFalecimento: '08:15',
    localFalecimento: 'Residência',
    causaMortis: 'Causas naturais',
    medicoDeclarante: {
      nome: 'Dra. Maria Santos',
      crm: 'RJ-789012'
    },
    criadoEm: '2024-01-20'
  }
];

// ==================== SERVIÇOS ====================
export const mockServiceCategories: ServiceCategory[] = [
  { id: '1', name: 'Serviços Básicos', description: 'Serviços essenciais funerários' },
  { id: '2', name: 'Serviços Premium', description: 'Serviços diferenciados' },
  { id: '3', name: 'Translado', description: 'Serviços de transporte' }
];

export const mockServices: Service[] = [
  {
    id: '1',
    categoryId: '1',
    categoryName: 'Serviços Básicos',
    name: 'Velório Básico',
    description: 'Capela por 24 horas com decoração básica',
    basePrice: 2500.00,
    costPrice: 1500.00,
    durationHours: 24,
    status: 'ativo'
  },
  {
    id: '2',
    categoryId: '1',
    categoryName: 'Serviços Básicos',
    name: 'Sepultamento',
    description: 'Serviço completo de sepultamento',
    basePrice: 3500.00,
    costPrice: 2000.00,
    durationHours: 4,
    status: 'ativo'
  },
  {
    id: '3',
    categoryId: '2',
    categoryName: 'Serviços Premium',
    name: 'Velório Premium',
    description: 'Capela premium com decoração luxuosa',
    basePrice: 5000.00,
    costPrice: 3000.00,
    durationHours: 24,
    status: 'ativo'
  },
  {
    id: '4',
    categoryId: '3',
    categoryName: 'Translado',
    name: 'Translado Municipal',
    description: 'Transporte dentro da cidade',
    basePrice: 800.00,
    costPrice: 400.00,
    durationHours: 2,
    status: 'ativo'
  }
];

// ==================== PRODUTOS ====================
export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Urna Premium',
    description: 'Urna funerária em madeira nobre',
    category: 'Urnas',
    price: 1200.00,
    cost: 600.00,
    stock: 15,
    stockMin: 5,
    supplierId: '1',
    supplierName: 'Fornecedor ABC',
    status: 'ativo'
  },
  {
    id: '2',
    name: 'Coroa de Flores Grande',
    description: 'Coroa de flores naturais',
    category: 'Flores',
    price: 350.00,
    cost: 150.00,
    stock: 30,
    stockMin: 10,
    supplierId: '2',
    supplierName: 'Flores & Cia',
    status: 'ativo'
  },
  {
    id: '3',
    name: 'Vela Memorial',
    description: 'Vela decorativa para velório',
    category: 'Decoração',
    price: 45.00,
    cost: 15.00,
    stock: 100,
    stockMin: 20,
    status: 'ativo'
  }
];

// ==================== ATENDIMENTOS ====================
export const mockAtendimentos: Atendimento[] = [
  {
    id: '1',
    codigo: 'ATD-00001',
    clientId: '1',
    clientName: 'João Silva',
    deceasedId: '1',
    deceasedName: 'Ana Silva',
    userId: '1',
    userName: 'Admin',
    serviceDate: '2024-01-16',
    status: 'em_andamento',
    totalValue: 6850.00,
    paidValue: 3000.00,
    notes: 'Família solicitou capela premium',
    services: [
      {
        id: '1',
        attendanceId: '1',
        serviceId: '3',
        serviceName: 'Velório Premium',
        quantity: 1,
        unitPrice: 5000.00,
        subtotal: 5000.00
      },
      {
        id: '2',
        attendanceId: '1',
        serviceId: '2',
        serviceName: 'Sepultamento',
        quantity: 1,
        unitPrice: 3500.00,
        subtotal: 3500.00
      }
    ],
    products: [
      {
        id: '1',
        attendanceId: '1',
        productId: '1',
        productName: 'Urna Premium',
        quantity: 1,
        unitPrice: 1200.00,
        subtotal: 1200.00
      },
      {
        id: '2',
        attendanceId: '1',
        productId: '2',
        productName: 'Coroa de Flores Grande',
        quantity: 2,
        unitPrice: 350.00,
        subtotal: 700.00
      }
    ],
    contract: {
      id: '1',
      attendanceId: '1',
      contractNumber: 'CT-2024-00001',
      status: 'assinado',
      signedAt: '2024-01-15T10:00:00'
    },
    criadoEm: '2024-01-15',
    atualizadoEm: '2024-01-16'
  },
  {
    id: '2',
    codigo: 'ATD-00002',
    clientId: '2',
    clientName: 'Maria Oliveira',
    deceasedId: '2',
    deceasedName: 'Pedro Oliveira',
    userId: '1',
    userName: 'Admin',
    serviceDate: '2024-01-21',
    status: 'concluido',
    totalValue: 4300.00,
    paidValue: 4300.00,
    services: [
      {
        id: '3',
        attendanceId: '2',
        serviceId: '1',
        serviceName: 'Velório Básico',
        quantity: 1,
        unitPrice: 2500.00,
        subtotal: 2500.00
      },
      {
        id: '4',
        attendanceId: '2',
        serviceId: '2',
        serviceName: 'Sepultamento',
        quantity: 1,
        unitPrice: 3500.00,
        subtotal: 3500.00
      }
    ],
    products: [],
    criadoEm: '2024-01-20',
    atualizadoEm: '2024-01-21'
  }
];

// ==================== FINANCEIRO ====================
export const mockAccountsReceivable: AccountReceivable[] = [
  {
    id: '1',
    attendanceId: '1',
    clientId: '1',
    clientName: 'João Silva',
    dueDate: '2024-01-20',
    amount: 6850.00,
    paidAmount: 3000.00,
    status: 'parcial',
    installments: [
      {
        id: '1',
        receivableId: '1',
        installmentNumber: 1,
        dueDate: '2024-01-20',
        amount: 3425.00,
        paidAmount: 3000.00,
        status: 'parcial',
        paymentDate: '2024-01-18'
      },
      {
        id: '2',
        receivableId: '1',
        installmentNumber: 2,
        dueDate: '2024-02-20',
        amount: 3425.00,
        paidAmount: 0,
        status: 'pendente'
      }
    ]
  },
  {
    id: '2',
    attendanceId: '2',
    clientId: '2',
    clientName: 'Maria Oliveira',
    dueDate: '2024-01-21',
    amount: 4300.00,
    paidAmount: 4300.00,
    status: 'pago',
    paymentDate: '2024-01-21'
  }
];

export const mockPayments: Payment[] = [
  {
    id: '1',
    receivableId: '1',
    amount: 3000.00,
    paymentMethod: 'pix',
    paymentDate: '2024-01-18',
    transactionId: 'PIX-20240118-001',
    notes: 'Pagamento parcial via PIX'
  },
  {
    id: '2',
    receivableId: '2',
    amount: 4300.00,
    paymentMethod: 'cartao_credito',
    paymentDate: '2024-01-21',
    transactionId: 'CC-20240121-001'
  }
];

export const mockCashFlow: CashFlow[] = [
  {
    id: '1',
    date: '2024-01-18',
    type: 'entrada',
    category: 'Atendimento',
    description: 'Pagamento parcial - ATD-00001',
    amount: 3000.00,
    balance: 3000.00,
    userId: '1',
    userName: 'Admin'
  },
  {
    id: '2',
    date: '2024-01-21',
    type: 'entrada',
    category: 'Atendimento',
    description: 'Pagamento completo - ATD-00002',
    amount: 4300.00,
    balance: 7300.00,
    userId: '1',
    userName: 'Admin'
  },
  {
    id: '3',
    date: '2024-01-22',
    type: 'saida',
    category: 'Fornecedor',
    description: 'Pagamento fornecedor - Flores & Cia',
    amount: 300.00,
    balance: 7000.00,
    userId: '1',
    userName: 'Admin'
  }
];

// ==================== OPERACIONAL ====================
export const mockVenues: Venue[] = [
  {
    id: '1',
    name: 'Capela São José',
    type: 'capela',
    capacity: 50,
    hourlyRate: 50.00,
    status: 'ocupado',
    location: 'Bloco A - Térreo'
  },
  {
    id: '2',
    name: 'Sala de Despedida Premium',
    type: 'sala_despedida',
    capacity: 30,
    hourlyRate: 80.00,
    status: 'disponivel',
    location: 'Bloco B - 2º Andar'
  },
  {
    id: '3',
    name: 'Velório Central',
    type: 'sala_velorio',
    capacity: 80,
    hourlyRate: 60.00,
    status: 'disponivel',
    location: 'Bloco Central'
  }
];

export const mockVenueBookings: VenueBooking[] = [
  {
    id: '1',
    attendanceId: '1',
    venueId: '1',
    venueName: 'Capela São José',
    startDatetime: '2024-01-16T08:00:00',
    endDatetime: '2024-01-17T08:00:00',
    status: 'em_andamento'
  }
];

export const mockVehicles: Vehicle[] = [
  {
    id: '1',
    plate: 'ABC-1234',
    model: 'Mercedes-Benz Sprinter',
    type: 'carro_funerario',
    status: 'em_uso',
    lastMaintenance: '2024-01-01',
    nextMaintenance: '2024-04-01'
  },
  {
    id: '2',
    plate: 'XYZ-5678',
    model: 'Ford Transit',
    type: 'carro_funerario',
    status: 'disponivel',
    lastMaintenance: '2023-12-15',
    nextMaintenance: '2024-03-15'
  }
];

export const mockOperationalTasks: OperationalTask[] = [
  {
    id: '1',
    attendanceId: '1',
    taskName: 'Preparação do corpo',
    assignedTo: '2',
    assignedToName: 'Funcionário Operacional',
    status: 'concluida',
    completedAt: '2024-01-16T09:00:00'
  },
  {
    id: '2',
    attendanceId: '1',
    taskName: 'Decoração da capela',
    assignedTo: '2',
    assignedToName: 'Funcionário Operacional',
    status: 'em_andamento'
  }
];

// ==================== CEMITÉRIOS ====================
export const mockCemeteries: Cemetery[] = [
  {
    id: '1',
    name: 'Cemitério da Consolação',
    address: 'Rua da Consolação, 1660',
    city: 'São Paulo',
    state: 'SP',
    contactPhone: '(11) 3256-7890',
    managerName: 'José da Silva'
  },
  {
    id: '2',
    name: 'Cemitério São João Batista',
    address: 'Rua General Severiano, 186',
    city: 'Rio de Janeiro',
    state: 'RJ',
    contactPhone: '(21) 2234-5678',
    managerName: 'Maria Santos'
  }
];

export const mockBurialPlots: BurialPlot[] = [
  {
    id: '1',
    cemeteryId: '1',
    cemeteryName: 'Cemitério da Consolação',
    section: 'A',
    row: '10',
    number: '25',
    type: 'jazigo',
    status: 'ocupado',
    ownerId: '1',
    ownerName: 'João Silva',
    price: 15000.00
  },
  {
    id: '2',
    cemeteryId: '1',
    cemeteryName: 'Cemitério da Consolação',
    section: 'B',
    row: '5',
    number: '12',
    type: 'gaveta',
    status: 'disponivel',
    price: 5000.00
  }
];

// ==================== FORNECEDORES ====================
export const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'Fornecedor ABC',
    cnpj: '12.345.678/0001-90',
    contactName: 'Carlos Mendes',
    phone: '(11) 3456-7890',
    email: 'contato@fornecedorabc.com.br',
    address: 'Rua das Flores, 100 - São Paulo/SP',
    paymentTerms: '30 dias',
    status: 'ativo'
  },
  {
    id: '2',
    name: 'Flores & Cia',
    cnpj: '98.765.432/0001-10',
    contactName: 'Ana Costa',
    phone: '(11) 9876-5432',
    email: 'vendas@floresecia.com.br',
    address: 'Av. Paulista, 1000 - São Paulo/SP',
    paymentTerms: '15 dias',
    status: 'ativo'
  }
];

export const mockStockMovements: StockMovement[] = [
  {
    id: '1',
    productId: '1',
    productName: 'Urna Premium',
    type: 'entrada',
    quantity: 20,
    unitCost: 600.00,
    totalCost: 12000.00,
    reason: 'Compra - Fornecedor ABC',
    userId: '1',
    userName: 'Admin',
    createdAt: '2024-01-10'
  },
  {
    id: '2',
    productId: '2',
    productName: 'Coroa de Flores Grande',
    type: 'saida',
    quantity: 2,
    unitCost: 150.00,
    totalCost: 300.00,
    reason: 'Venda - ATD-00001',
    userId: '1',
    userName: 'Admin',
    createdAt: '2024-01-16'
  }
];