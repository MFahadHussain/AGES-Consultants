/**
 * Convert a number to words (English, PKR format)
 * Example: 125750 → "Rupees One Hundred Twenty Five Thousand Seven Hundred Fifty Only"
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen']

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertHundreds(num: number): string {
  if (num === 0) return ''
  if (num < 20) return ones[num]
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '')
  }
  return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertHundreds(num % 100) : '')
}

export function numberToWords(amount: number): string {
  if (amount === 0) return 'Rupees Zero Only'
  if (amount < 0) return 'Negative ' + numberToWords(Math.abs(amount))

  const integerPart = Math.floor(amount)
  const decimalPart = Math.round((amount - integerPart) * 100)

  let words = ''

  if (integerPart > 0) {
    // Handle billions
    if (integerPart >= 1_000_000_000) {
      const billions = Math.floor(integerPart / 1_000_000_000)
      words += convertHundreds(billions) + ' Billion'
      const remainder = integerPart % 1_000_000_000
      if (remainder > 0) words += ' '
    }

    // Handle millions
    const millionsRemainder = integerPart % 1_000_000_000
    if (millionsRemainder >= 1_000_000) {
      const millions = Math.floor(millionsRemainder / 1_000_000)
      words += convertHundreds(millions) + ' Million'
      const remainder = millionsRemainder % 1_000_000
      if (remainder > 0) words += ' '
    }

    // Handle thousands
    const thousandsRemainder = integerPart % 1_000_000
    if (thousandsRemainder >= 1_000) {
      const thousands = Math.floor(thousandsRemainder / 1_000)
      words += convertHundreds(thousands) + ' Thousand'
      const remainder = thousandsRemainder % 1_000
      if (remainder > 0) words += ' '
    }

    // Handle hundreds and below
    const hundredsRemainder = integerPart % 1_000
    if (hundredsRemainder > 0) {
      words += convertHundreds(hundredsRemainder)
    }
  }

  let result = 'Rupees ' + words.trim()

  if (decimalPart > 0) {
    result += ' and ' + convertHundreds(decimalPart) + ' Paisa'
  }

  result += ' Only'

  return result
}
