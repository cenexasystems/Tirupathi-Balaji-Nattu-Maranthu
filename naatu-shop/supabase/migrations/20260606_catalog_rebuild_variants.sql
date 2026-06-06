-- ============================================================
-- CATALOG REBUILD — Source of truth: owner catalog 2026-06-06
-- ============================================================

-- 1. Schema: add group_name for Brand+Weight (Type D) products
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS group_name TEXT;

-- 2. Set has_variants = true for 6 confirmed variant products
UPDATE products SET has_variants = true
WHERE name IN ('Agarbatti','Karpooram','Kungumam','Vibhoothi','Manjal Podi','Nalla Ennai');

-- 3. Update base price for variant products (= default/lowest variant price)
UPDATE products SET price = 55  WHERE name = 'Agarbatti';
UPDATE products SET price = 40  WHERE name = 'Karpooram';
UPDATE products SET price = 20  WHERE name = 'Kungumam';
UPDATE products SET price = 20  WHERE name = 'Vibhoothi';
UPDATE products SET price = 15  WHERE name = 'Manjal Podi';
UPDATE products SET price = 45  WHERE name = 'Nalla Ennai';

-- 4. Deactivate Thiru Neeru (semantic duplicate of Vibhoothi)
UPDATE products SET is_active = false WHERE name = 'Thiru Neeru';

-- 5. Update image_url to Images_V2 for confirmed P1 products
UPDATE products SET image_url = '/assets/Images_V2/Amala Podi.jpeg'           WHERE name = 'Amla Podi';
UPDATE products SET image_url = '/assets/Images_V2/Ashwagandha Podi.jpeg'     WHERE name = 'Ashwagandha Podi';
UPDATE products SET image_url = '/assets/Images_V2/Deepam Thiri Cotton.jpeg'  WHERE name = 'Deepam Thiri';
UPDATE products SET image_url = '/assets/Images_V2/Elakkai.jpeg'              WHERE name = 'Elakkai';
UPDATE products SET image_url = '/assets/Images_V2/Ellu.jpeg'                 WHERE name = 'Ellu';
UPDATE products SET image_url = '/assets/Images_V2/Honey(thaen).jpeg'         WHERE name = 'Then';
UPDATE products SET image_url = '/assets/Images_V2/Jathikkai.jpeg'            WHERE name = 'Jathikai';
UPDATE products SET image_url = '/assets/Images_V2/Kadalai Paruppu.jpeg'      WHERE name = 'Kadalai Paruppu';
UPDATE products SET image_url = '/assets/Images_V2/Kalkandu.jpeg'             WHERE name = 'Kalkandu';
UPDATE products SET image_url = '/assets/Images_V2/Kandankathiri Podi.jpeg'   WHERE name = 'Kandankathiri Podi';
UPDATE products SET image_url = '/assets/Images_V2/Karpooram.jpeg'            WHERE name = 'Karpooram';
UPDATE products SET image_url = '/assets/Images_V2/Kolamavu.jpeg'             WHERE name = 'Kolamavu';
UPDATE products SET image_url = '/assets/Images_V2/Kungumam.jpeg'             WHERE name = 'Kungumam';
UPDATE products SET image_url = '/assets/Images_V2/Lavangam.jpeg'             WHERE name = 'Lavangam';
UPDATE products SET image_url = '/assets/Images_V2/Manjal Podi.jpeg'          WHERE name = 'Manjal Podi';
UPDATE products SET image_url = '/assets/Images_V2/Murungai Elai Podi.jpeg'   WHERE name = 'Murungai Podi';
UPDATE products SET image_url = '/assets/Images_V2/Nei Dodla.jpeg'            WHERE name = 'Nei';
UPDATE products SET image_url = '/assets/Images_V2/Omam Podi.jpeg'            WHERE name = 'Omam Podi';
UPDATE products SET image_url = '/assets/Images_V2/Pacha Arisi.jpeg'          WHERE name = 'Pacharisi';
UPDATE products SET image_url = '/assets/Images_V2/Panchakavyam Liquid.jpeg'  WHERE name = 'Panchagavyam';
UPDATE products SET image_url = '/assets/Images_V2/Panneer 200ml.jpeg'        WHERE name = 'Panneer';
UPDATE products SET image_url = '/assets/Images_V2/Pasi Payiru.jpeg'          WHERE name = 'Pasi Paruppu';
UPDATE products SET image_url = '/assets/Images_V2/Pattai.jpeg'               WHERE name = 'Pattai';
UPDATE products SET image_url = '/assets/Images_V2/Poornahuthi Saaman.jpeg'   WHERE name = 'Poornahuthi Saamaan';
UPDATE products SET image_url = '/assets/Images_V2/Sandhanam.jpeg'            WHERE name = 'Sandhanam';
UPDATE products SET image_url = '/assets/Images_V2/Santhanathi Oil.jpeg'      WHERE name = 'Sandal Oil';
UPDATE products SET image_url = '/assets/Images_V2/Thenga Ennai.jpeg'         WHERE name = 'Thengai Ennai';
UPDATE products SET image_url = '/assets/Images_V2/Thripala Podi.jpeg'        WHERE name = 'Triphala Podi';
UPDATE products SET image_url = '/assets/Images_V2/Thulasi Podi.jpeg'         WHERE name = 'Thulasi Podi';
UPDATE products SET image_url = '/assets/Images_V2/Ulundhu White.jpeg'        WHERE name = 'Ulundhu';
UPDATE products SET image_url = '/assets/Images_V2/Vasambu.jpeg'              WHERE name = 'Vasambu';
UPDATE products SET image_url = '/assets/Images_V2/Vendhayam Podi.jpeg'       WHERE name = 'Vendhayam Podi';
UPDATE products SET image_url = '/assets/Images_V2/Veppa ennai.jpeg'          WHERE name = 'Veppa Ennai';
UPDATE products SET image_url = '/assets/Images_V2/Veppalai Podi.jpeg'        WHERE name = 'Veppalai Podi';
UPDATE products SET image_url = '/assets/Images_V2/Viboothi-Sithanathan.jpeg' WHERE name = 'Vibhoothi';
UPDATE products SET image_url = '/assets/Images_V2/Vilakennai Oil.jpeg'       WHERE name = 'Vilakkennai';
UPDATE products SET image_url = '/assets/Images_V2/Navagraha Bit Polyster.jpeg' WHERE name = 'Navagraha Bit';
UPDATE products SET image_url = '/assets/Images_V2/Agarbatti Cycle.jpeg'      WHERE name = 'Agarbatti';

-- 6. Delete ALL orphaned variant rows (181 rows pointing to deleted product UUIDs)
DELETE FROM product_variants;

-- 7. Agarbatti (Type C: Brand Variant)
INSERT INTO product_variants (product_id,variant_name,size_label,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'Cycle','Cycle Brand',55,100,true,true,1,NULL,'/assets/Images_V2/Agarbatti Cycle.jpeg' FROM products p WHERE p.name='Agarbatti' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'Z Black','Z Black Brand',60,100,false,true,2,NULL,'/assets/Images_V2/Agarbatti Z Black.jpeg' FROM products p WHERE p.name='Agarbatti' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'Bindhu','Bindhu Brand',70,100,false,true,3,NULL,'/assets/Images_V2/Agarbatti Cycle.jpeg' FROM products p WHERE p.name='Agarbatti' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'Miracle','Miracle Brand',100,100,false,true,4,NULL,'/assets/Images_V2/Agarbatti Miracle.jpeg' FROM products p WHERE p.name='Agarbatti' AND p.is_active=true LIMIT 1;

-- 8. Karpooram (Type B: Weight Variant)
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'25g','25g',25,'g',40,100,true,true,1,NULL,'/assets/Images_V2/Karpooram.jpeg' FROM products p WHERE p.name='Karpooram' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'50g','50g',50,'g',70,100,false,true,2,NULL,'/assets/Images_V2/Karpooram.jpeg' FROM products p WHERE p.name='Karpooram' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'250g','250g',250,'g',350,100,false,true,3,NULL,'/assets/Images_V2/Karpooram.jpeg' FROM products p WHERE p.name='Karpooram' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'500g','500g',500,'g',650,100,false,true,4,NULL,'/assets/Images_V2/Karpooram.jpeg' FROM products p WHERE p.name='Karpooram' AND p.is_active=true LIMIT 1;

-- 9. Kungumam (Type B: Weight, proportional pricing — 50g=₹20 base)
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'50g','50g',50,'g',20,100,true,true,1,NULL,'/assets/Images_V2/Kungumam.jpeg' FROM products p WHERE p.name='Kungumam' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'100g','100g',100,'g',40,100,false,true,2,NULL,'/assets/Images_V2/Kungumam.jpeg' FROM products p WHERE p.name='Kungumam' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'250g','250g',250,'g',100,100,false,true,3,NULL,'/assets/Images_V2/Kungumam.jpeg' FROM products p WHERE p.name='Kungumam' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'500g','500g',500,'g',200,100,false,true,4,NULL,'/assets/Images_V2/Kungumam.jpeg' FROM products p WHERE p.name='Kungumam' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'1kg','1kg',1000,'g',400,100,false,true,5,NULL,'/assets/Images_V2/Kungumam.jpeg' FROM products p WHERE p.name='Kungumam' AND p.is_active=true LIMIT 1;

-- 10. Vibhoothi (Type D: Brand+Weight)
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'50g','50g',50,'g',20,100,true,true,1,'Sithanathan','/assets/Images_V2/Viboothi-Sithanathan.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'125g','125g',125,'g',35,100,false,true,2,'Sithanathan','/assets/Images_V2/Viboothi-Sithanathan.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'250g','250g',250,'g',70,100,false,true,3,'Sithanathan','/assets/Images_V2/Viboothi-Sithanathan.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'500g','500g',500,'g',95,100,false,true,4,'Sithanathan','/assets/Images_V2/Viboothi-Sithanathan.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'125g','125g',125,'g',40,100,false,true,5,'Baskaran','/assets/Images_V2/Vibhoothi-Baskaran.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'250g','250g',250,'g',60,100,false,true,6,'Baskaran','/assets/Images_V2/Vibhoothi-Baskaran.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'500g','500g',500,'g',100,100,false,true,7,'Baskaran','/assets/Images_V2/Vibhoothi-Baskaran.jpeg' FROM products p WHERE p.name='Vibhoothi' AND p.is_active=true LIMIT 1;

-- 11. Manjal Podi (Type B: Weight)
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'50g','50g',50,'g',15,100,true,true,1,NULL,'/assets/Images_V2/Manjal Podi.jpeg' FROM products p WHERE p.name='Manjal Podi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'100g','100g',100,'g',30,100,false,true,2,NULL,'/assets/Images_V2/Manjal Podi.jpeg' FROM products p WHERE p.name='Manjal Podi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'250g','250g',250,'g',75,100,false,true,3,NULL,'/assets/Images_V2/Manjal Podi.jpeg' FROM products p WHERE p.name='Manjal Podi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'500g','500g',500,'g',150,100,false,true,4,NULL,'/assets/Images_V2/Manjal Podi.jpeg' FROM products p WHERE p.name='Manjal Podi' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'1kg','1kg',1000,'g',300,100,false,true,5,NULL,'/assets/Images_V2/Manjal Podi.jpeg' FROM products p WHERE p.name='Manjal Podi' AND p.is_active=true LIMIT 1;

-- 12. Nalla Ennai (Type B: Volume)
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'100ml','100ml',100,'ml',45,100,true,true,1,NULL,NULL FROM products p WHERE p.name='Nalla Ennai' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'250ml','250ml',250,'ml',75,100,false,true,2,NULL,NULL FROM products p WHERE p.name='Nalla Ennai' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'500ml','500ml',500,'ml',165,100,false,true,3,NULL,NULL FROM products p WHERE p.name='Nalla Ennai' AND p.is_active=true LIMIT 1;
INSERT INTO product_variants (product_id,variant_name,size_label,weight_value,weight_unit,price,stock,is_default,is_active,sort_order,group_name,image_url)
SELECT p.id::text,'1L','1L',1000,'ml',330,100,false,true,4,NULL,NULL FROM products p WHERE p.name='Nalla Ennai' AND p.is_active=true LIMIT 1;
