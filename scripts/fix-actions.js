const fs = require('fs')
const path = require('path')

const filePath = '/vercel/share/v0-project/lib/actions.ts'
console.log('Patching:', filePath)
let content = fs.readFileSync(filePath, 'utf8')

// Replace ALL .eq('user_id', user.id).eq('status', 'current').single() patterns
content = content.replaceAll(
  `.eq('user_id', user.id).eq('status', 'current').single()`,
  `.eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()`
)

// Also the multi-line variant
content = content.replaceAll(
  `.eq('user_id', user.id)\n    .eq('status', 'current')\n    .single()`,
  `.eq('user_id', user.id)\n    .in('status', ['current', 'unverified', 'late'])\n    .single()`
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Done. File length:', content.length)
const remaining = (content.match(/eq\('status', 'current'\)/g) || []).length
console.log('Remaining eq(status,current) occurrences:', remaining)
