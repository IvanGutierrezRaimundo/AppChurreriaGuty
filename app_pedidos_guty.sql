CREATE DATABASE  IF NOT EXISTS `app_pedidos_guty` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `app_pedidos_guty`;
-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: app_pedidos_guty
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nif` varchar(15) DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `ciudad` varchar(50) DEFAULT NULL,
  `provincia` varchar(50) DEFAULT NULL,
  `cp` varchar(10) DEFAULT NULL,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proveedores`
--

DROP TABLE IF EXISTS `proveedores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proveedores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nif` varchar(15) DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `ciudad` varchar(50) DEFAULT NULL,
  `provincia` varchar(50) DEFAULT NULL,
  `cp` varchar(10) DEFAULT NULL,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_proveedores_nif` (`nif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proveedores`
--

LOCK TABLES `proveedores` WRITE;
/*!40000 ALTER TABLE `proveedores` DISABLE KEYS */;
/*!40000 ALTER TABLE `proveedores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `info_empresa`
--

DROP TABLE IF EXISTS `info_empresa`;
CREATE TABLE `info_empresa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `informacion` varchar(255) NOT NULL,
  `fecha_registro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `precios`
--

DROP TABLE IF EXISTS `precios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `precios` (
  `id` int NOT NULL,
  `precio_churro` decimal(10,2) NOT NULL,
  `precio_chocolate` decimal(10,2) NOT NULL,
  `precio_envio` decimal(10,2) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_precios_singleton` CHECK ((`id` = 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `precios`
--

LOCK TABLES `precios` WRITE;
/*!40000 ALTER TABLE `precios` DISABLE KEYS */;
INSERT INTO `precios` VALUES (1,0.25,1.50,25.00,CURRENT_TIMESTAMP);
/*!40000 ALTER TABLE `precios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedidos`
--

DROP TABLE IF EXISTS `pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedidos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `telefono` varchar(30) NOT NULL,
  `email` varchar(120) DEFAULT NULL,
  `cp` varchar(6) DEFAULT NULL,
  `direccion` varchar(180) DEFAULT NULL,
  `ciudad` varchar(120) DEFAULT NULL,
  `provincia` varchar(120) DEFAULT NULL,
  `nif` varchar(20) DEFAULT NULL,
  `solicita_factura` tinyint(1) NOT NULL DEFAULT '0',
  `personas` int DEFAULT NULL,
  `churros_por_persona` int DEFAULT NULL,
  `chocolates` int DEFAULT NULL,
  `fecha` date NOT NULL,
  `hora` time NOT NULL,
  `requiere_envio` tinyint(1) NOT NULL DEFAULT '0',
  `direccion_entrega` varchar(180) DEFAULT NULL,
  `metodo_pago` varchar(30) NOT NULL,
  `comentarios` text,
  `presupuesto_total` decimal(10,2) NOT NULL,
  `precio_churro` decimal(10,2) DEFAULT NULL,
  `precio_chocolate` decimal(10,2) DEFAULT NULL,
  `precio_envio` decimal(10,2) DEFAULT NULL,
  `descuento` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('Pendiente','Realizado','Cobrado','Cancelado') NOT NULL DEFAULT 'Pendiente',
  PRIMARY KEY (`id`),
  KEY `idx_pedidos_fecha` (`fecha`),
  KEY `idx_pedidos_pago` (`metodo_pago`),
  KEY `idx_pedidos_envio` (`requiere_envio`),
  KEY `idx_pedidos_nif` (`nif`),
  CONSTRAINT `chk_factura_campos` CHECK (((`solicita_factura` = false) or ((`provincia` is not null) and (`nif` is not null)))),
  CONSTRAINT `chk_presupuesto_min` CHECK ((`presupuesto_total` >= 100))
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedidos`
--

LOCK TABLES `pedidos` WRITE;
/*!40000 ALTER TABLE `pedidos` DISABLE KEYS */;
INSERT INTO `pedidos` VALUES (2,'pepe Suarez González','623589785','lalibrepaisaneta@gmail.com','33001','Calle Uria 18','Oviedo','Asturias','09426816J',0,900,4,900,'2026-02-17','12:00:00',1,'Avenida los monumentos 43 1 izda','transferencia','que barato todo',2275.00,'2026-02-17 11:11:25','Pendiente'),(3,'Ivan gutierrez raimundo','+34686866160','ivangutierrezraimundo@gmail.com','33002','Avenida los monumentos 43 1 izda','Oviedo','leon','09426816J',1,3000,4,200,'2026-02-25','23:00:00',1,'Avenida los monumentos 43 1 izda','transferencia','mola mucho',3325.00,'2026-02-18 17:00:36','Realizado'),(4,'sanchez','698741235','hfhfhfh@gmail.com','33009','el limón 23 colloto','Oviedo','Asturias','09426816J',1,100,4,100,'2026-02-28','16:00:00',1,'chinatown 14','transferencia',NULL,275.00,'2026-02-18 19:26:37','Cobrado'),(8,'jaimito garia','652301147','labamaba@yahoo.es','33009','Calle el perro nº5','Oviedo','Asturias','09426816J',0,100,4,100,'2026-06-01','18:00:00',1,'Calle el gato nº56','local','sin azucar',275.00,'2026-05-30 10:58:40','Pendiente'),(12,'Juan','600000000',NULL,NULL,NULL,NULL,NULL,NULL,0,10,4,70,'2026-06-02','18:00:00',1,NULL,'transferencia',NULL,140.00,'2026-06-03 11:33:03','Realizado'),(20,'San salvador','600456321','sansalvadorgmail.com',NULL,NULL,NULL,NULL,NULL,0,100,12,100,'2026-06-12','10:00:00',0,NULL,'local','no',450.00,'2026-06-03 16:03:55','Cobrado'),(23,'Ivan gutierrez raimundo','600894456','ivangutierrezraimundo@gmail.com',NULL,'hace una cosa rara con los titulos de cada dato, por ejemplo con direccion : , pone direcc y en la s',NULL,NULL,NULL,0,100,6,100,'2026-06-17','10:00:00',1,'hace una cosa rara con los titulos de cada dato, por ejemplo con direccion : , pone direcc y en la s','transferencia','hace una cosa rara con los titulos de cada dato, por ejemplo con direccion : , pone direcc y en la siguiente linea ón, con comentarios pone en cada linea : com enta rios ... si no entra que el titulo',325.00,'2026-06-05 10:16:47','Cobrado'),(24,'Test','600000000',NULL,NULL,NULL,NULL,NULL,NULL,0,100,6,0,'2026-06-20','10:00:00',0,NULL,'local',NULL,150.00,'2026-06-05 11:00:57','Cobrado'),(25,'Ivan gutierrez raimundo','600123456','ivangutierrezraimundo@gmail.com',NULL,NULL,NULL,NULL,NULL,0,100,6,100,'2026-06-24','10:00:00',1,'sdnfjadnfjnadsf 78','entrega',NULL,325.00,'2026-06-05 11:09:35','Cobrado');
/*!40000 ALTER TABLE `pedidos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-14 12:30:00
