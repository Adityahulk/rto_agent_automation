import {
  Prisma,
  PrismaClient,
  TenantSubscriptionStatus,
  VehicleType,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function money(v: string | number): Prisma.Decimal {
  return new Prisma.Decimal(v)
}

function guessStateFromAddress(address: string): string | null {
  const u = address.toLowerCase()
  const pairs: [string, string][] = [
    ['maharashtra', 'Maharashtra'],
    ['karnataka', 'Karnataka'],
    ['kerala', 'Kerala'],
    ['delhi', 'Delhi'],
    ['gujarat', 'Gujarat'],
    ['tamil nadu', 'Tamil Nadu'],
    ['west bengal', 'West Bengal'],
    ['chandigarh', 'Chandigarh'],
  ]
  for (const [needle, state] of pairs) {
    if (u.includes(needle)) return state
  }
  return null
}

function guessCityFromAddress(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim())
  if (parts.length >= 2) {
    return parts[parts.length - 2] ?? null
  }
  return null
}

async function main() {
  const now = new Date()
  const oneYearFromNow = new Date(now)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
  const sixMonthsFromNow = new Date(now)
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6)
  const tenDaysAgo = new Date(now)
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

  await prisma.$transaction([
    prisma.quote.deleteMany(),
    prisma.rtoForm.deleteMany(),
    prisma.serviceCharge.deleteMany(),
    prisma.feeCalculation.deleteMany(),
    prisma.insurancePolicy.deleteMany(),
    prisma.fitnessRecord.deleteMany(),
    prisma.pUCRecord.deleteMany(),
    prisma.permitRecord.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.client.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.tenant.deleteMany(),
    prisma.admin.deleteMany(),
    prisma.feeRateVersion.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.feeRate.deleteMany(),
  ])

  const adminHash = await bcrypt.hash('admin123', 10)
  const agentHash = await bcrypt.hash('agent123', 10)

  await prisma.admin.create({
    data: {
      email: 'admin@rtohelper.in',
      passwordHash: adminHash,
    },
  })

  await prisma.appSetting.createMany({
    data: [
      { key: 'subscription.renewal_inr', value: '1500' },
      { key: 'subscription.list_inr', value: '2000' },
    ],
  })

  const tenantRajesh = await prisma.tenant.create({
    data: {
      name: 'Rajesh Kumar Agencies',
      email: 'rajesh@example.com',
      passwordHash: agentHash,
      businessName: 'RK Vehicle Consultants',
      whatsappNumber: '+919820112345',
      subscriptionStatus: TenantSubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: oneYearFromNow,
    },
  })

  const tenantPriya = await prisma.tenant.create({
    data: {
      name: 'Priya Motors',
      email: 'priya@example.com',
      passwordHash: agentHash,
      businessName: 'Priya Motors Pvt Ltd',
      whatsappNumber: '+919876543210',
      subscriptionStatus: TenantSubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: sixMonthsFromNow,
    },
  })

  const tenantOld = await prisma.tenant.create({
    data: {
      name: 'Old Agent',
      email: 'old@example.com',
      passwordHash: agentHash,
      businessName: 'Old Agent RTO Services',
      whatsappNumber: '+919811122233',
      subscriptionStatus: TenantSubscriptionStatus.EXPIRED,
      subscriptionExpiresAt: tenDaysAgo,
    },
  })

  await prisma.subscription.createMany({
    data: [
      {
        tenantId: tenantRajesh.id,
        plan: 'Professional Annual',
        amount: money(24999),
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: oneYearFromNow,
        paymentId: 'pay_rk_annual_001',
      },
      {
        tenantId: tenantPriya.id,
        plan: 'Growth Semi-Annual',
        amount: money(12999),
        startDate: new Date(now.getFullYear(), now.getMonth() - 2, 15),
        endDate: sixMonthsFromNow,
        paymentId: 'pay_priya_growth_002',
      },
    ],
  })

  const clientsData: { name: string; phone: string; address: string }[] = [
    {
      name: 'Vikram Joshi',
      phone: '+919820145678',
      address: 'Flat 402, Sai Krupa CHS, Andheri West, Mumbai 400058, Maharashtra',
    },
    {
      name: 'Ananya Iyer',
      phone: '+919811234567',
      address: '12, 4th Cross, Indiranagar, Bengaluru 560038, Karnataka',
    },
    {
      name: 'Rohit Sharma',
      phone: '+919876512340',
      address: 'B-14, Sector 21, Dwarka, New Delhi 110077',
    },
    {
      name: 'Kavita Nair',
      phone: '+919845678901',
      address: 'Door 7-2-42, MG Road, Kochi 682031, Kerala',
    },
    {
      name: 'Manish Patil',
      phone: '+919765432109',
      address: 'Plot 88, Kothrud, Pune 411038, Maharashtra',
    },
    {
      name: 'Deepa Krishnan',
      phone: '+919912345678',
      address: '18, Anna Nagar East, Chennai 600102, Tamil Nadu',
    },
    {
      name: 'Suresh Menon',
      phone: '+919833221144',
      address: 'Tower B, Lodha Palava, Dombivli East 421204, Maharashtra',
    },
    {
      name: 'Meera Shah',
      phone: '+919922334455',
      address: 'Shop 4, CG Road, Navrangpura, Ahmedabad 380009, Gujarat',
    },
    {
      name: 'Aditya Agarwal',
      phone: '+919887766554',
      address: 'H.No. 56, Greater Kailash II, New Delhi 110048',
    },
    {
      name: 'Pooja Verma',
      phone: '+919955443322',
      address: 'Villa 3, Whitefield Main Road, Bengaluru 560066, Karnataka',
    },
    {
      name: 'Karthik Subramanian',
      phone: '+919944332211',
      address: '92, T Nagar, Chennai 600017, Tamil Nadu',
    },
    {
      name: 'Neha Kapoor',
      phone: '+919933221100',
      address: 'Sector 15, Vashi, Navi Mumbai 400703, Maharashtra',
    },
    {
      name: 'Amit Bansal',
      phone: '+919922110099',
      address: 'SCO 12, Sector 17, Chandigarh 160017',
    },
    {
      name: 'Swati Kulkarni',
      phone: '+919911009988',
      address: 'Row House 5, Baner, Pune 411045, Maharashtra',
    },
    {
      name: 'Rahul Bhattacharya',
      phone: '+919900887766',
      address: 'Lake Town, Block B, Kolkata 700089, West Bengal',
    },
  ]

  const clients = await Promise.all(
    clientsData.map((c) =>
      prisma.client.create({
        data: {
          tenantId: tenantRajesh.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          city: guessCityFromAddress(c.address),
          state: guessStateFromAddress(c.address),
        },
      }),
    ),
  )

  const twoWheelMakes = [
    { make: 'Hero', model: 'Splendor Plus' },
    { make: 'Honda', model: 'Activa 6G' },
    { make: 'TVS', model: 'Jupiter' },
    { make: 'Bajaj', model: 'Pulsar 150' },
    { make: 'Royal Enfield', model: 'Classic 350' },
  ]

  const fourWheelMakes = [
    { make: 'Maruti Suzuki', model: 'Swift VXI' },
    { make: 'Hyundai', model: 'Creta SX' },
    { make: 'Tata', model: 'Nexon EV Max' },
    { make: 'Mahindra', model: 'Scorpio N' },
    { make: 'Toyota', model: 'Innova Crysta' },
  ]

  const vehicles: { id: string; clientIndex: number }[] = []
  let regCounter = 1001

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    const isEven = i % 2 === 0
    const tw = twoWheelMakes[i % twoWheelMakes.length]
    const fw = fourWheelMakes[i % fourWheelMakes.length]

    const v1 = await prisma.vehicle.create({
      data: {
        clientId: client.id,
        vehicleNumber: `MH01AB${regCounter++}`,
        make: isEven ? tw.make : fw.make,
        model: isEven ? tw.model : fw.model,
        fuelType: isEven ? 'Petrol' : i % 3 === 0 ? 'Diesel' : 'Petrol',
        vehicleType: isEven ? VehicleType.TWO_W : VehicleType.FOUR_W,
        chassisNumber: `MA1RE${String(100000 + i).slice(0, 6)}CH${i}`,
        engineNumber: `EN${regCounter}RK${i}`,
      },
    })
    vehicles.push({ id: v1.id, clientIndex: i })

    const v2 = await prisma.vehicle.create({
      data: {
        clientId: client.id,
        vehicleNumber: `MH02CD${regCounter++}`,
        make: isEven ? fw.make : tw.make,
        model: isEven ? fw.model : tw.model,
        fuelType: isEven ? 'CNG' : 'Petrol',
        vehicleType: isEven ? VehicleType.FOUR_W : VehicleType.TWO_W,
        chassisNumber: `MA1RE${String(200000 + i).slice(0, 6)}CH${i}B`,
        engineNumber: `EN${regCounter}RK${i}B`,
      },
    })
    vehicles.push({ id: v2.id, clientIndex: i })
  }

  const firstVehiclePerClient = vehicles.filter((_, idx) => idx % 2 === 0)

  const insurers = [
    'ICICI Lombard',
    'HDFC ERGO',
    'Bajaj Allianz',
    'New India Assurance',
    'Reliance General',
  ]

  for (let i = 0; i < 15; i++) {
    const vehicleId = firstVehiclePerClient[i].id
    const start = new Date(now)
    start.setFullYear(start.getFullYear() - 1)

    let expiryDate: Date
    let status: string

    if (i < 5) {
      expiryDate = new Date(now)
      expiryDate.setDate(expiryDate.getDate() + 45 + i * 10)
      status = 'ACTIVE'
    } else if (i < 10) {
      expiryDate = new Date(now)
      expiryDate.setDate(expiryDate.getDate() + 8 + i)
      status = 'EXPIRING_SOON'
    } else {
      expiryDate = new Date(now)
      expiryDate.setDate(expiryDate.getDate() - (40 + (i - 10) * 15))
      status = 'EXPIRED'
    }

    await prisma.insurancePolicy.create({
      data: {
        vehicleId,
        tenantId: tenantRajesh.id,
        policyNumber: `POL-MH-2024-${5000 + i}`,
        insurer: insurers[i % insurers.length],
        policyType: i % 2 === 0 ? 'Comprehensive' : 'Third Party',
        premium: money(3500 + i * 420),
        startDate: start,
        expiryDate,
        status,
      },
    })
  }

  const fitnessTargets = firstVehiclePerClient.slice(0, 5)
  const fitnessExpiries = [
    new Date(now.getFullYear() + 1, 2, 15),
    new Date(now.getFullYear(), now.getMonth() + 2, 10),
    new Date(now.getFullYear() + 1, 5, 1),
    new Date(now.getFullYear() - 1, 8, 1),
    new Date(now.getFullYear(), now.getMonth() - 1, 5),
  ]

  for (let i = 0; i < 5; i++) {
    const vf = new Date(fitnessExpiries[i])
    vf.setFullYear(vf.getFullYear() - 1)
    await prisma.fitnessRecord.create({
      data: {
        vehicleId: fitnessTargets[i].id,
        tenantId: tenantRajesh.id,
        certificateNumber: `FC-MH-2024-${1000 + i}`,
        issuedBy: i % 2 === 0 ? 'RTO Andheri' : 'RTO Pune',
        validFrom: vf,
        expiryDate: fitnessExpiries[i],
      },
    })
  }

  for (let i = 0; i < 6; i++) {
    const vehicleId = vehicles[i].id
    const pucExpiry = new Date(now)
    if (i < 2) {
      pucExpiry.setDate(pucExpiry.getDate() + 40 + i * 8)
    } else if (i < 4) {
      pucExpiry.setDate(pucExpiry.getDate() + 12 + i)
    } else {
      pucExpiry.setDate(pucExpiry.getDate() - (20 + i * 5))
    }
    await prisma.pUCRecord.create({
      data: {
        vehicleId,
        tenantId: tenantRajesh.id,
        pucNumber: `PUC-MH-${80000 + i}`,
        testCenter: 'Authorized PUC Center, Pune',
        expiryDate: pucExpiry,
      },
    })
  }

  for (let i = 0; i < 4; i++) {
    const vehicleId = vehicles[i + 3].id
    const permitExpiry = new Date(now)
    if (i === 0) permitExpiry.setMonth(permitExpiry.getMonth() + 10)
    else if (i === 1) permitExpiry.setDate(permitExpiry.getDate() + 18)
    else if (i === 2) permitExpiry.setDate(permitExpiry.getDate() - 5)
    else permitExpiry.setMonth(permitExpiry.getMonth() - 2)
    await prisma.permitRecord.create({
      data: {
        vehicleId,
        tenantId: tenantRajesh.id,
        permitType: i % 2 === 0 ? 'National Permit' : 'State Permit',
        issuedState: 'Maharashtra',
        expiryDate: permitExpiry,
      },
    })
  }

  const feeCalcSpecs: {
    clientIndex: number
    state: string
    vehicleType: VehicleType
    invoicePrice: string
    totalTax: string
    totalFees: string
    grandTotal: string
  }[] = [
    { clientIndex: 0, state: 'Maharashtra', vehicleType: VehicleType.TWO_W, invoicePrice: '85000', totalTax: '4250', totalFees: '3200', grandTotal: '92450' },
    { clientIndex: 1, state: 'Karnataka', vehicleType: VehicleType.FOUR_W, invoicePrice: '925000', totalTax: '138750', totalFees: '18500', grandTotal: '1082250' },
    { clientIndex: 2, state: 'Delhi', vehicleType: VehicleType.FOUR_W, invoicePrice: '1120000', totalTax: '168000', totalFees: '21200', grandTotal: '1309200' },
    { clientIndex: 3, state: 'Maharashtra', vehicleType: VehicleType.FOUR_W, invoicePrice: '780000', totalTax: '117000', totalFees: '16800', grandTotal: '913800' },
    { clientIndex: 4, state: 'Karnataka', vehicleType: VehicleType.TWO_W, invoicePrice: '92000', totalTax: '4600', totalFees: '3100', grandTotal: '99700' },
    { clientIndex: 5, state: 'Delhi', vehicleType: VehicleType.TWO_W, invoicePrice: '72000', totalTax: '3600', totalFees: '2900', grandTotal: '78500' },
    { clientIndex: 6, state: 'Maharashtra', vehicleType: VehicleType.COMMERCIAL, invoicePrice: '1850000', totalTax: '92500', totalFees: '28500', grandTotal: '1971000' },
    { clientIndex: 7, state: 'Karnataka', vehicleType: VehicleType.FOUR_W, invoicePrice: '645000', totalTax: '96750', totalFees: '15400', grandTotal: '757150' },
    { clientIndex: 8, state: 'Delhi', vehicleType: VehicleType.FOUR_W, invoicePrice: '998000', totalTax: '149700', totalFees: '19800', grandTotal: '1167500' },
    { clientIndex: 9, state: 'Maharashtra', vehicleType: VehicleType.TWO_W, invoicePrice: '118000', totalTax: '5900', totalFees: '3350', grandTotal: '127250' },
  ]

  const feeCalculationsCreated: { id: string; clientId: string }[] = []
  for (let i = 0; i < 10; i++) {
    const spec = feeCalcSpecs[i]
    const client = clients[spec.clientIndex]
    const fc = await prisma.feeCalculation.create({
      data: {
        tenantId: tenantRajesh.id,
        clientId: client.id,
        state: spec.state,
        vehicleType: spec.vehicleType,
        invoicePrice: money(spec.invoicePrice),
        totalTax: money(spec.totalTax),
        totalFees: money(spec.totalFees),
        grandTotal: money(spec.grandTotal),
        createdAt: new Date(now.getTime() - (10 - i) * 86400000),
      },
    })
    feeCalculationsCreated.push({ id: fc.id, clientId: fc.clientId })
  }

  for (let i = 0; i < 5; i++) {
    const fc = feeCalculationsCreated[i]
    await prisma.quote.create({
      data: {
        tenantId: tenantRajesh.id,
        clientId: fc.clientId,
        calculationId: fc.id,
        sentViaWhatsapp: i % 2 === 0,
      },
    })
  }

  const serviceRows = [
    { clientIndex: 0, service: 'Hypothecation removal', amount: '1500' },
    { clientIndex: 2, service: 'NOC processing', amount: '800' },
    { clientIndex: 4, service: 'Duplicate RC application', amount: '2200' },
    { clientIndex: 6, service: 'Address change on RC', amount: '950' },
    { clientIndex: 8, service: 'Fast-track fitness slot', amount: '1200' },
  ]

  for (const row of serviceRows) {
    await prisma.serviceCharge.create({
      data: {
        tenantId: tenantRajesh.id,
        clientId: clients[row.clientIndex].id,
        service: row.service,
        amount: money(row.amount),
        date: new Date(now.getTime() - 3 * 86400000),
      },
    })
  }

  type FeeBand = {
    state: string
    vehicleType: VehicleType
    minPrice: string
    maxPrice: string
    roadTaxPercent: string
    registrationFee: string
    hsrpFee: string
    smartCardFee: string
  }

  const feeBands: FeeBand[] = []

  const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Gujarat', 'Tamil Nadu'] as const
  const types = [VehicleType.TWO_W, VehicleType.FOUR_W, VehicleType.COMMERCIAL] as const

  const illustrativeRates: Record<
    string,
    Record<string, { tax: string; reg: string; hsrp: string; smart: string; min: string; max: string }>
  > = {
    Maharashtra: {
      TWO_W: { tax: '0.07', reg: '1850', hsrp: '400', smart: '200', min: '50000', max: '200000' },
      FOUR_W: { tax: '0.14', reg: '6500', hsrp: '1100', smart: '200', min: '400000', max: '2500000' },
      COMMERCIAL: { tax: '0.05', reg: '12000', hsrp: '900', smart: '200', min: '800000', max: '5000000' },
    },
    Delhi: {
      TWO_W: { tax: '0.04', reg: '1600', hsrp: '350', smart: '200', min: '45000', max: '180000' },
      FOUR_W: { tax: '0.12', reg: '7200', hsrp: '1000', smart: '200', min: '350000', max: '2200000' },
      COMMERCIAL: { tax: '0.045', reg: '11000', hsrp: '850', smart: '200', min: '750000', max: '4500000' },
    },
    Karnataka: {
      TWO_W: { tax: '0.12', reg: '2100', hsrp: '450', smart: '200', min: '55000', max: '220000' },
      FOUR_W: { tax: '0.13', reg: '6800', hsrp: '1050', smart: '200', min: '420000', max: '2600000' },
      COMMERCIAL: { tax: '0.055', reg: '12500', hsrp: '950', smart: '200', min: '900000', max: '5200000' },
    },
    Gujarat: {
      TWO_W: { tax: '0.06', reg: '1750', hsrp: '380', smart: '200', min: '48000', max: '190000' },
      FOUR_W: { tax: '0.13', reg: '6400', hsrp: '1020', smart: '200', min: '380000', max: '2300000' },
      COMMERCIAL: { tax: '0.05', reg: '11800', hsrp: '880', smart: '200', min: '820000', max: '4800000' },
    },
    'Tamil Nadu': {
      TWO_W: { tax: '0.08', reg: '1950', hsrp: '420', smart: '200', min: '52000', max: '210000' },
      FOUR_W: { tax: '0.14', reg: '6600', hsrp: '1080', smart: '200', min: '410000', max: '2400000' },
      COMMERCIAL: { tax: '0.052', reg: '12200', hsrp: '920', smart: '200', min: '850000', max: '5000000' },
    },
  }

  for (const state of states) {
    for (const vehicleType of types) {
      const r = illustrativeRates[state][vehicleType]
      feeBands.push({
        state,
        vehicleType,
        minPrice: r.min,
        maxPrice: r.max,
        roadTaxPercent: r.tax,
        registrationFee: r.reg,
        hsrpFee: r.hsrp,
        smartCardFee: r.smart,
      })
    }
  }

  await prisma.feeRate.createMany({
    data: feeBands.map((b) => ({
      state: b.state,
      vehicleType: b.vehicleType,
      minPrice: money(b.minPrice),
      maxPrice: money(b.maxPrice),
      roadTaxPercent: money(b.roadTaxPercent),
      registrationFee: money(b.registrationFee),
      hsrpFee: money(b.hsrpFee),
      smartCardFee: money(b.smartCardFee),
    })),
  })

  console.log('Seed completed:', {
    admin: 1,
    tenants: 3,
    clients: clients.length,
    vehicles: vehicles.length,
    insurancePolicies: 15,
    fitnessRecords: 5,
    feeCalculations: 10,
    serviceCharges: 5,
    feeRates: feeBands.length,
    subscriptions: 2,
    tenantsCreated: [tenantRajesh.email, tenantPriya.email, tenantOld.email],
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
