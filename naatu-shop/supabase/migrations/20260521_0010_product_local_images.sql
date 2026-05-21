-- Migration 0010: Map local product images to products
-- Run in Supabase SQL editor.
-- Updates image_url to serve local PNG assets from /assets/images/.

UPDATE public.products SET image_url = '/assets/images/Kungumam.png'          WHERE name = 'Kungumam';
UPDATE public.products SET image_url = '/assets/images/Karpooram.png'         WHERE name = 'Karpooram';
UPDATE public.products SET image_url = '/assets/images/Agarbatti.png'         WHERE name = 'Agarbatti';
UPDATE public.products SET image_url = '/assets/images/Sandhanam.png'         WHERE name = 'Sandhanam';
UPDATE public.products SET image_url = '/assets/images/Thiru Neer.png'        WHERE name = 'Thiru Neeru';
UPDATE public.products SET image_url = '/assets/images/Poo varisai.png'       WHERE name = 'Poo Varisai';
UPDATE public.products SET image_url = '/assets/images/Panchagavyam.png'      WHERE name = 'Panchagavyam';
UPDATE public.products SET image_url = '/assets/images/Navagraha Bit.png'     WHERE name = 'Navagraha Bit';
UPDATE public.products SET image_url = '/assets/images/kutthu vilakku.png'    WHERE name = 'Kuthu Vilakku';
UPDATE public.products SET image_url = '/assets/images/swami padam.png'       WHERE name = 'Swami Padam';
UPDATE public.products SET image_url = '/assets/images/thamarai.png'          WHERE name = 'Thamarai';
UPDATE public.products SET image_url = '/assets/images/Deepam Thiri.png'      WHERE name = 'Deepam Thiri';
UPDATE public.products SET image_url = '/assets/images/kolamaavu.png'         WHERE name = 'Kolamavu';

UPDATE public.products SET image_url = '/assets/images/Manjal Podi.png'       WHERE name = 'Manjal Podi';
UPDATE public.products SET image_url = '/assets/images/Thulasi podi.png'      WHERE name = 'Thulasi Podi';
UPDATE public.products SET image_url = '/assets/images/Veppalai Podi.png'     WHERE name = 'Veppalai Podi';
UPDATE public.products SET image_url = '/assets/images/Vendhayam Podi.png'    WHERE name = 'Vendhayam Podi';
UPDATE public.products SET image_url = '/assets/images/Omam Podi.png'         WHERE name = 'Omam Podi';
UPDATE public.products SET image_url = '/assets/images/Seeragam Podi.png'     WHERE name = 'Seeragam Podi';
UPDATE public.products SET image_url = '/assets/images/Milagu Podi.png'       WHERE name = 'Milagu Podi';
UPDATE public.products SET image_url = '/assets/images/Ashwagandha Podi.png'  WHERE name = 'Ashwagandha Podi';
UPDATE public.products SET image_url = '/assets/images/Amala Podi.png'        WHERE name = 'Amla Podi';
UPDATE public.products SET image_url = '/assets/images/Triphala Podi.png'     WHERE name = 'Triphala Podi';
UPDATE public.products SET image_url = '/assets/images/Brahmi Podi.png'       WHERE name = 'Brahmi Podi';
UPDATE public.products SET image_url = '/assets/images/Murungai Podi.png'     WHERE name = 'Murungai Podi';
UPDATE public.products SET image_url = '/assets/images/Sathavari Podi.png'    WHERE name = 'Sathavari Podi';
UPDATE public.products SET image_url = '/assets/images/Kandankathari Podi.png' WHERE name = 'Kandankathiri Podi';
UPDATE public.products SET image_url = '/assets/images/Nithyakalyani Podi.png' WHERE name = 'Nithyakalyani Podi';

UPDATE public.products SET image_url = '/assets/images/Veppa Ennai.png'       WHERE name = 'Veppa Ennai';
UPDATE public.products SET image_url = '/assets/images/Nalla Ennai.png'       WHERE name = 'Nalla Ennai';
UPDATE public.products SET image_url = '/assets/images/Vilakkennai.png'       WHERE name = 'Vilakkennai';
UPDATE public.products SET image_url = '/assets/images/Thengai Ennai.png'     WHERE name = 'Thengai Ennai';
UPDATE public.products SET image_url = '/assets/images/Omam ennai.png'        WHERE name = 'Omam Ennai';
UPDATE public.products SET image_url = '/assets/images/Brahmi Ennai.png'      WHERE name = 'Brahmi Ennai';
UPDATE public.products SET image_url = '/assets/images/Milagu Ennai.png'      WHERE name = 'Milagu Ennai';
UPDATE public.products SET image_url = '/assets/images/Pungam Ennai.png'      WHERE name = 'Pungam Ennai';

UPDATE public.products SET image_url = '/assets/images/Kalkandu.png'          WHERE name = 'Kalkandu';
UPDATE public.products SET image_url = '/assets/images/Elakkai.png'           WHERE name = 'Elakkai';
UPDATE public.products SET image_url = '/assets/images/Pattai.png'            WHERE name = 'Pattai';
UPDATE public.products SET image_url = '/assets/images/Kothamalli.png'        WHERE name = 'Kothamalli';
UPDATE public.products SET image_url = '/assets/images/Ellu.png'              WHERE name = 'Ellu';

-- Verify: show updated products
SELECT name, image_url
FROM public.products
WHERE image_url LIKE '/assets/%'
ORDER BY sort_order;
