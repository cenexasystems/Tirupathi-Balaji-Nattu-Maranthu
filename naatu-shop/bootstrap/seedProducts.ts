import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import "dotenv/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing Supabase environment variables")
  console.error("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedProducts() {
  try {
    const productsPath = path.join(__dirname, "products.json")
    const productsData = fs.readFileSync(productsPath, "utf-8")
    const products = JSON.parse(productsData)

    const { count, error: checkError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })

    if (checkError) {
      console.error("❌ Error checking existing products:", checkError.message)
      process.exit(1)
    }

    if ((count || 0) > 0) {
      console.warn(`⚠️  Warning: Products table already has ${count} products`)
      process.exit(0)
    }

    const batchSize = 10
    let insertedCount = 0

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, Math.min(i + batchSize, products.length))
      const { error: insertError } = await supabase
        .from("products")
        .insert(batch)
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError.message)
        process.exit(1)
      }
      insertedCount += batch.length
      console.log(`✅ Inserted ${insertedCount}/${products.length} products`)
    }

    console.log(`🎉 Database seeding successful!`)
  } catch (error) {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  }
}

seedProducts()
