import { CardImage, CardMetadataTags } from '../types';

/**
 * Generates the standardized filename for the cropped/enhanced asset.
 * This exact function MUST be used across:
 * 1. Image downloads & ZIP archive generation
 * 2. Standard Catalog CSV export (Asset Filename column)
 * 3. eBay File Exchange CSV export (CustomLabel column)
 * 4. Manifest JSON generation
 */
export function getEnhancedFileName(
  card: CardImage | { file: { name: string }; metadata?: CardMetadataTags },
  options: {
    useMetadataPrefix?: boolean;
    format?: 'png' | 'jpg';
  } = {}
): string {
  const { useMetadataPrefix = true, format = 'png' } = options;
  const originalName = card.file.name;
  const safeName = originalName.replace(/\.[^/.]+$/, '').replace(/[^\w.-]/g, '_');
  const meta = card.metadata;
  const extension = format === 'jpg' ? 'jpg' : 'png';

  if (!useMetadataPrefix || (!meta?.cardSeries && !meta?.year && !meta?.setName && !meta?.player && !meta?.manufacturer)) {
    return `enhanced_${safeName}.${extension}`;
  }

  // Construct structured, human-readable and filesystem-safe filename
  const cleanPart = (str?: string) => (str ? str.trim().replace(/[^\w.-]/g, '_').replace(/_+/g, '_') : '');

  const parts: string[] = [];
  if (meta.year) parts.push(cleanPart(meta.year));
  if (meta.manufacturer && !meta.cardSeries?.toLowerCase().includes(meta.manufacturer.toLowerCase())) {
    parts.push(cleanPart(meta.manufacturer));
  }
  if (meta.cardSeries) parts.push(cleanPart(meta.cardSeries));
  if (meta.setName && meta.setName !== meta.cardSeries) parts.push(cleanPart(meta.setName));
  if (meta.player) parts.push(cleanPart(meta.player));

  const prefix = parts.length > 0 ? `${parts.join('_')}_` : '';
  return `${prefix}enhanced_${safeName}.${extension}`;
}

/**
 * Escapes a cell value for RFC 4180 compliant CSV output
 */
export function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Standard Structured Catalog CSV
 * Ideal for inventory software, spreadsheet databases, and collection managers
 */
export function generateCatalogCsv(
  cards: CardImage[],
  options: {
    useMetadataPrefix?: boolean;
  } = {}
): string {
  const headers = [
    'Cropped Asset Filename',
    'Original Filename',
    'Card Title',
    'Sport / Category',
    'Player / Athlete',
    'Manufacturer',
    'Release Year',
    'Series / Product',
    'Set / Parallel / Insert',
    'Card Number',
    'Print Run / Serial Number',
    'Autographed',
    'Target Grade',
    'Condition',
    'Resolution',
    'Processing Status',
    'Lot / Notes'
  ];

  const rows = cards.map(card => {
    const meta = card.metadata || {};
    const enhancedFileName = getEnhancedFileName(card, options);
    
    // Construct readable title if not explicit
    const titleParts = [
      meta.year,
      meta.manufacturer,
      meta.cardSeries,
      meta.setName,
      meta.player,
      meta.parallel,
      meta.cardNumber ? `#${meta.cardNumber}` : '',
      meta.printRun ? `/${meta.printRun}` : '',
      meta.autographed === 'Yes' || meta.autographed === true ? 'AUTO' : ''
    ].filter(Boolean);

    const title = titleParts.length > 0 
      ? titleParts.join(' ') 
      : card.file.name.replace(/\.[^/.]+$/, '');

    const isAutographed = meta.autographed === 'Yes' || meta.autographed === true 
      ? 'Yes' 
      : meta.autographed === 'No' || meta.autographed === false 
        ? 'No' 
        : (card.file.name.toLowerCase().includes('auto') ? 'Yes' : 'No');

    const resolution = card.originalWidth ? `${card.originalWidth}x${card.originalHeight}` : 'Original Scan';

    return [
      escapeCsvCell(enhancedFileName),
      escapeCsvCell(card.file.name),
      escapeCsvCell(title),
      escapeCsvCell(meta.sport || 'Sports / Non-Sport Trading Cards'),
      escapeCsvCell(meta.player || ''),
      escapeCsvCell(meta.manufacturer || (meta.cardSeries?.includes('Upper Deck') ? 'Upper Deck' : meta.cardSeries?.includes('Topps') ? 'Topps' : meta.cardSeries?.includes('Panini') ? 'Panini' : '')),
      escapeCsvCell(meta.year || ''),
      escapeCsvCell(meta.cardSeries || ''),
      escapeCsvCell(meta.setName || meta.parallel || ''),
      escapeCsvCell(meta.cardNumber || ''),
      escapeCsvCell(meta.printRun || ''),
      escapeCsvCell(isAutographed),
      escapeCsvCell(meta.gradeTarget || 'Raw / Ungraded'),
      escapeCsvCell(meta.condition || 'Near mint or better'),
      escapeCsvCell(resolution),
      escapeCsvCell(card.status),
      escapeCsvCell(meta.notes || '')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * eBay Trading Cards File Exchange CSV
 * Uses the exact schema provided for Category 261328 (Trading Card Singles)
 * CustomLabel matches the cropped asset filename for seamless listing image association.
 */
export const EBAY_CSV_HEADER = 
  '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),CustomLabel,*Category,StoreCategory,*Title,Subtitle,Relationship,RelationshipDetails,ScheduleTime,*ConditionID,CD:Professional Grader - (ID: 27501),CD:Grade - (ID: 27502),CDA:Certification Number - (ID: 27503),CD:Card Condition - (ID: 40001),*C:Sport,C:Player/Athlete,C:Manufacturer,C:Season,C:Parallel/Variety,C:Features,C:Set,C:Team,C:League,C:Autographed,C:Card Name,C:Card Number,C:Type,C:Year Manufactured,C:Signed By,C:Autograph Authentication,C:Country of Origin,C:Card Size,C:Material,C:Autograph Format,C:Event/Tournament,C:Vintage,C:Language,C:Original/Licensed Reprint,C:Autograph Authentication Number,C:California Prop 65 Warning,C:Card Thickness,C:Customized,C:Insert Set,C:Print Run,PicURL,GalleryType,VideoID,*Description,*Format,*Duration,*StartPrice,BuyItNowPrice,BestOfferEnabled,BestOfferAutoAcceptPrice,MinimumBestOfferPrice,*Quantity,ImmediatePayRequired,*Location,ShippingType,ShippingService-1:Option,ShippingService-1:Cost,ShippingService-2:Option,ShippingService-2:Cost,*DispatchTimeMax,PromotionalShippingDiscount,ShippingDiscountProfileID,*ReturnsAcceptedOption,ReturnsWithinOption,RefundOption,ShippingCostPaidByOption,AdditionalDetails,ShippingProfileName,ReturnProfileName,PaymentProfileName,Product Safety Pictograms,Product Safety Statements,Product Safety Component,Regulatory Document Ids,Manufacturer Name,Manufacturer AddressLine1,Manufacturer AddressLine2,Manufacturer City,Manufacturer Country,Manufacturer PostalCode,Manufacturer StateOrProvince,Manufacturer Phone,Manufacturer Email,Manufacturer ContactURL,Responsible Person 1,Responsible Person 1 Type,Responsible Person 1 AddressLine1,Responsible Person 1 AddressLine2,Responsible Person 1 City,Responsible Person 1 Country,Responsible Person 1 PostalCode,Responsible Person 1 StateOrProvince,Responsible Person 1 Phone,Responsible Person 1 Email,Responsible Person 1 ContactURL';

export function generateEbayExchangeCsv(
  cards: CardImage[],
  options: {
    useMetadataPrefix?: boolean;
    defaultPrice?: string;
    defaultShipping?: string;
    defaultZipCode?: string;
  } = {}
): string {
  const { useMetadataPrefix = true, defaultPrice = '19.99' } = options;

  const rows = cards.map(card => {
    const meta = card.metadata || {};
    const enhancedFileName = getEnhancedFileName(card, { useMetadataPrefix });

    // Detect sport / league
    let sport = meta.sport || '';
    let league = meta.league || '';
    const seriesLower = (meta.cardSeries || '').toLowerCase();
    const setLower = (meta.setName || '').toLowerCase();
    const playerLower = (meta.player || '').toLowerCase();
    const fileLower = card.file.name.toLowerCase();

    if (seriesLower.includes('aew') || setLower.includes('aew') || fileLower.includes('aew') || 
        playerLower.includes('shida') || playerLower.includes('hart') || playerLower.includes('melo')) {
      sport = sport || 'Wrestling';
      league = league || 'AEW';
    } else if (seriesLower.includes('prizm') || seriesLower.includes('nba') || playerLower.includes('jordan') || playerLower.includes('wembanyama')) {
      sport = sport || 'Basketball';
      league = league || 'NBA';
    } else if (seriesLower.includes('topps') || seriesLower.includes('bowman') || playerLower.includes('mantle') || playerLower.includes('judge')) {
      sport = sport || 'Baseball';
      league = league || 'MLB';
    } else {
      sport = sport || 'Sports Trading Cards';
    }

    // Detect manufacturer
    let manufacturer = meta.manufacturer || '';
    if (!manufacturer) {
      if (seriesLower.includes('upper deck') || setLower.includes('black diamond')) manufacturer = 'Upper Deck';
      else if (seriesLower.includes('topps') || seriesLower.includes('bowman') || seriesLower.includes('chrome')) manufacturer = 'Topps';
      else if (seriesLower.includes('panini') || seriesLower.includes('prizm') || seriesLower.includes('donruss')) manufacturer = 'Panini';
      else if (seriesLower.includes('leaf') || fileLower.includes('leaf')) manufacturer = 'Leaf';
    }

    const year = meta.year || '2024';
    const player = meta.player || meta.cardSeries || 'Single Card';
    const isAutographed = meta.autographed === 'Yes' || meta.autographed === true || fileLower.includes('auto');

    // Compose crisp eBay listing title (max 80 chars)
    const titleParts = [
      year,
      manufacturer,
      meta.cardSeries?.replace(manufacturer, '').trim(),
      player,
      meta.setName,
      meta.printRun ? `#/${meta.printRun}` : '',
      isAutographed ? 'AUTO' : ''
    ].filter(Boolean);

    let title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
    if (title.length > 80) {
      title = title.substring(0, 80).trim();
    }
    if (!title) {
      title = card.file.name.replace(/\.[^/.]+$/, '').substring(0, 80);
    }

    // Build features string
    const featuresList: string[] = [];
    if (isAutographed) featuresList.push('Autograph');
    if (meta.printRun) featuresList.push('Serial Numbered', 'Short Print');
    if (setLower.includes('patch') || seriesLower.includes('patch')) featuresList.push('Memorabilia');
    if (setLower.includes('refractor') || setLower.includes('prizm') || setLower.includes('holo')) featuresList.push('Parallel/Variety');
    const features = featuresList.join(', ');

    // Description referencing the matching cropped asset
    const description = `"${title} Raw/ungraded single. Cropped asset: ${enhancedFileName}. Please see high-resolution photos, which are of the actual card."`;

    const conditionID = '4000'; // Very Good / Near Mint
    const cardCondition = meta.condition || 'Near mint or better';
    const startPrice = meta.price ? String(meta.price) : defaultPrice;

    // Construct array of all columns in order matching EBAY_CSV_HEADER (84 columns)
    const cols = [
      'Add',                                          // *Action
      enhancedFileName,                              // CustomLabel (matches cropped asset filename!)
      '261328',                                       // *Category (Trading Card Singles)
      '',                                             // StoreCategory
      title,                                          // *Title
      '',                                             // Subtitle
      '',                                             // Relationship
      '',                                             // RelationshipDetails
      '',                                             // ScheduleTime
      conditionID,                                   // *ConditionID
      '',                                             // CD:Professional Grader
      '',                                             // CD:Grade
      '',                                             // CDA:Certification Number
      cardCondition,                                 // CD:Card Condition
      sport,                                          // *C:Sport
      player,                                         // C:Player/Athlete
      manufacturer,                                  // C:Manufacturer
      year,                                           // C:Season
      meta.parallel || meta.setName || '',           // C:Parallel/Variety
      features,                                       // C:Features
      meta.cardSeries || meta.setName || '',         // C:Set
      meta.team || '',                               // C:Team
      league,                                         // C:League
      isAutographed ? 'Yes' : 'No',                  // C:Autographed
      player,                                         // C:Card Name
      meta.cardNumber || '',                          // C:Card Number
      'Sports Trading Card',                         // C:Type
      year,                                           // C:Year Manufactured
      isAutographed ? player : '',                   // C:Signed By
      isAutographed ? 'Upper Deck Authentic' : '',   // C:Autograph Authentication
      'United States',                                // C:Country of Origin
      'Standard',                                     // C:Card Size
      'Card Stock',                                   // C:Material
      isAutographed ? 'Hard Signed / Sticker' : '',  // C:Autograph Format
      '',                                             // C:Event/Tournament
      Number(year) < 1980 ? 'Yes' : 'No',            // C:Vintage
      'English',                                      // C:Language
      'Original',                                     // C:Original/Licensed Reprint
      '',                                             // C:Autograph Authentication Number
      '',                                             // C:California Prop 65 Warning
      setLower.includes('patch') ? '130 Pt.' : '35 Pt.', // C:Card Thickness
      'No',                                           // C:Customized
      meta.setName || '',                             // C:Insert Set
      meta.printRun || '',                            // C:Print Run
      '',                                             // PicURL
      '',                                             // GalleryType
      '',                                             // VideoID
      description,                                    // *Description
      'FixedPrice',                                   // *Format
      'GTC',                                          // *Duration
      startPrice,                                     // *StartPrice
      '',                                             // BuyItNowPrice
      '',                                             // BestOfferEnabled
      '',                                             // BestOfferAutoAcceptPrice
      '',                                             // MinimumBestOfferPrice
      '1',                                            // *Quantity
      '',                                             // ImmediatePayRequired
      '',                                             // *Location
      '',                                             // ShippingType
      '',                                             // ShippingService-1:Option
      '',                                             // ShippingService-1:Cost
      '',                                             // ShippingService-2:Option
      '',                                             // ShippingService-2:Cost
      '1',                                            // *DispatchTimeMax
      '',                                             // PromotionalShippingDiscount
      '',                                             // ShippingDiscountProfileID
      'ReturnsAccepted',                              // *ReturnsAcceptedOption
      '',                                             // ReturnsWithinOption
      '',                                             // RefundOption
      '',                                             // ShippingCostPaidByOption
      '',                                             // AdditionalDetails
      '',                                             // ShippingProfileName
      '',                                             // ReturnProfileName
      '',                                             // PaymentProfileName
      '', '', '', '', '', '', '', '', '', '', '', '', // Product safety & manufacturer address empty fields
      '', '', '', '', '', '', '', '', '', '', ''      // Responsible person fields
    ];

    return cols.map(escapeCsvCell).join(',');
  });

  return [EBAY_CSV_HEADER, ...rows].join('\r\n');
}

/**
 * Downloads text as a UTF-8 BOM CSV file to ensure maximum compatibility with Excel & Sheets
 */
export function downloadCsvFile(csvContent: string, fileName: string): void {
  // Prepend UTF-8 BOM (\uFEFF)
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies CSV content to system clipboard
 */
export async function copyCsvToClipboard(csvContent: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(csvContent);
    return true;
  } catch (err) {
    console.error('Failed to copy CSV to clipboard:', err);
    return false;
  }
}
