export const DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
] as const

export type Division = (typeof DIVISIONS)[number]

export const DISTRICTS_BY_DIVISION: Record<Division, readonly string[]> = {
  Dhaka: ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
  Chattogram: ['Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', 'Cox’s Bazar', 'Cumilla', 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'],
  Rajshahi: ['Bogura', 'Chapainawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Khulna: ['Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  Barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokathi', 'Patuakhali', 'Pirojpur'],
  Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
}

export function isDivision(value: string): value is Division {
  return (DIVISIONS as readonly string[]).includes(value)
}

export function districtsForDivision(division: string): readonly string[] {
  return isDivision(division) ? DISTRICTS_BY_DIVISION[division] : []
}

export function getDeliveryZoneForDivision(division: string): 'dhaka' | 'outside_dhaka' {
  const normalized = division.trim().toLocaleLowerCase()
  return normalized === 'dhaka' || normalized === 'ঢাকা' ? 'dhaka' : 'outside_dhaka'
}

/**
 * Legacy order/courier records still require separate district and area values.
 * When checkout collects one complete address instead, infer only values that
 * are actually present and mark missing structured values explicitly.
 */
export const ADDRESS_LOCATION_FALLBACK = 'ঠিকানায় উল্লেখিত'

const BENGALI_DISTRICT_NAMES: Record<string, string> = {
  Dhaka: 'ঢাকা',
  Faridpur: 'ফরিদপুর',
  Gazipur: 'গাজীপুর',
  Gopalganj: 'গোপালগঞ্জ',
  Kishoreganj: 'কিশোরগঞ্জ',
  Madaripur: 'মাদারীপুর',
  Manikganj: 'মানিকগঞ্জ',
  Munshiganj: 'মুন্সীগঞ্জ',
  Narayanganj: 'নারায়ণগঞ্জ',
  Narsingdi: 'নরসিংদী',
  Rajbari: 'রাজবাড়ী',
  Shariatpur: 'শরীয়তপুর',
  Tangail: 'টাঙ্গাইল',
  Bandarban: 'বান্দরবান',
  Brahmanbaria: 'ব্রাহ্মণবাড়িয়া',
  Chandpur: 'চাঁদপুর',
  Chattogram: 'চট্টগ্রাম',
  'Cox’s Bazar': 'কক্সবাজার',
  Cumilla: 'কুমিল্লা',
  Feni: 'ফেনী',
  Khagrachhari: 'খাগড়াছড়ি',
  Lakshmipur: 'লক্ষ্মীপুর',
  Noakhali: 'নোয়াখালী',
  Rangamati: 'রাঙ্গামাটি',
  Bogura: 'বগুড়া',
  Chapainawabganj: 'চাঁপাইনবাবগঞ্জ',
  Joypurhat: 'জয়পুরহাট',
  Naogaon: 'নওগাঁ',
  Natore: 'নাটোর',
  Pabna: 'পাবনা',
  Rajshahi: 'রাজশাহী',
  Sirajganj: 'সিরাজগঞ্জ',
  Bagerhat: 'বাগেরহাট',
  Chuadanga: 'চুয়াডাঙ্গা',
  Jashore: 'যশোর',
  Jhenaidah: 'ঝিনাইদহ',
  Khulna: 'খুলনা',
  Kushtia: 'কুষ্টিয়া',
  Magura: 'মাগুরা',
  Meherpur: 'মেহেরপুর',
  Narail: 'নড়াইল',
  Satkhira: 'সাতক্ষীরা',
  Barguna: 'বরগুনা',
  Barishal: 'বরিশাল',
  Bhola: 'ভোলা',
  Jhalokathi: 'ঝালকাঠি',
  Patuakhali: 'পটুয়াখালী',
  Pirojpur: 'পিরোজপুর',
  Habiganj: 'হবিগঞ্জ',
  Moulvibazar: 'মৌলভীবাজার',
  Sunamganj: 'সুনামগঞ্জ',
  Sylhet: 'সিলেট',
  Dinajpur: 'দিনাজপুর',
  Gaibandha: 'গাইবান্ধা',
  Kurigram: 'কুড়িগ্রাম',
  Lalmonirhat: 'লালমনিরহাট',
  Nilphamari: 'নীলফামারী',
  Panchagarh: 'পঞ্চগড়',
  Rangpur: 'রংপুর',
  Thakurgaon: 'ঠাকুরগাঁও',
  Jamalpur: 'জামালপুর',
  Mymensingh: 'ময়মনসিংহ',
  Netrokona: 'নেত্রকোনা',
  Sherpur: 'শেরপুর',
}

function normalizeAddressPart(value: string) {
  return value.toLocaleLowerCase().replace(/[.,;:|]+/g, ' ').replace(/[\/\\]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Converts one free-form delivery address into the still-required legacy
 * district/area fields. The complete original address remains authoritative.
 */
export function resolveDeliveryFieldsFromAddress(division: string, address: string) {
  const parts = address.split(/[,\n\r;،|।]+/).map((part) => part.trim()).filter(Boolean)
  const candidates = districtsForDivision(division)
    .flatMap((district) => [district, BENGALI_DISTRICT_NAMES[district]].filter(Boolean).map((alias) => ({ district, alias })))
    .sort((left, right) => right.alias.length - left.alias.length)

  let matched: { district: string; alias: string } | undefined
  let matchedIndex = -1
  for (const candidate of candidates) {
    const alias = normalizeAddressPart(candidate.alias)
    const matchesAlias = (value: string) => {
      const normalized = normalizeAddressPart(value)
      return normalized === alias || normalized.endsWith(' ' + alias)
    }
    const index = parts.findIndex(matchesAlias)
    if (index >= 0 || matchesAlias(address)) {
      matched = candidate
      matchedIndex = index
      break
    }
  }

  const areaCandidate = matchedIndex > 0 ? parts[matchedIndex - 1] : ''
  const area = areaCandidate && normalizeAddressPart(areaCandidate) !== normalizeAddressPart(division)
    ? areaCandidate.slice(0, 100)
    : ADDRESS_LOCATION_FALLBACK

  return {
    district: matched?.district ?? ADDRESS_LOCATION_FALLBACK,
    area,
  }
}

export function isAddressLocationFallback(value: string | null | undefined) {
  return value?.trim() === ADDRESS_LOCATION_FALLBACK
}
