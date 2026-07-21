# Documentation Technique - AgencyOS

Bienvenue dans la documentation complète de **AgencyOS**, une plateforme ERP et collaborative moderne conçue pour rationaliser la gestion des opérations, des ressources humaines, de la facturation et de la communication en temps réel au sein de l'entreprise.

---

## 1. Vue d'Ensemble du Projet

AgencyOS s'articule autour d'une architecture client-serveur robuste avec un découpage clair :
- **Backend** : Construit avec **NestJS** (TypeScript), exploitant **Prisma ORM** pour communiquer avec une base de données relationnelle **PostgreSQL**. La communication bidirectionnelle en temps réel est gérée via **Socket.IO**.
- **Frontend** : Construit avec **React** (TypeScript) et **Vite**, stylisé avec **Tailwind CSS** et un système de thèmes personnalisé (supportant le Light Mode premium).
- **Communication en temps réel (Appels)** : Intégration de **WebRTC** de pair à pair pour les appels audio/vidéo avec signalisation WebSocket.

---

## 2. Diagramme de Cas d'Utilisation Global (Use Case Diagram)

Ce diagramme exhaustif décrit les droits et interactions de chaque rôle (Gérant, RH, Comptable, Secrétaire, Chef de Projet, Collaborateur, Stagiaire) avec les différentes pages et fonctionnalités du système.

```mermaid
leftToRightDirection
actor "Gérant / CEO" as Gerant
actor "Responsable RH" as RH
actor "Responsable Financier" as Financier
actor "Secrétaire" as Secretaire
actor "Chef de Projet" as PM
actor "Collaborateur" as Collaborateur
actor "Stagiaire" as Stagiaire

rectangle AgencyOS {
  usecase "Gérer les utilisateurs et habilitations" as UC_UserAdmin
  usecase "Visualiser l'Intelligence Décisionnelle (IA)" as UC_DecisionIA
  
  usecase "Gérer les contrats et dossiers RH" as UC_RHAdmin
  usecase "Valider les demandes de congé" as UC_LeaveApproval
  usecase "Soumettre une demande de congé" as UC_LeaveSubmit
  
  usecase "Créer des factures et devis" as UC_FinanceDocs
  usecase "Approuver les factures et budgets" as UC_FinanceApprove
  
  usecase "Gérer les Leads & Clients (CRM)" as UC_CRM
  usecase "Organiser l'agenda & les réunions" as UC_Calendar
  
  usecase "Créer des projets et affecter des budgets" as UC_ProjectCreate
  usecase "Créer et affecter des Tâches" as UC_TasksAdmin
  usecase "Gérer ses tâches (Kanban Drag & Drop)" as UC_TasksUser
  
  usecase "Discuter en direct (DM & Groupes)" as UC_Chat
  usecase "Passer des appels audio/vidéo avec caméra" as UC_Calls
}

Gerant --> UC_UserAdmin
Gerant --> UC_DecisionIA
Gerant --> UC_FinanceApprove

RH --> UC_RHAdmin
RH --> UC_LeaveApproval

Financier --> UC_FinanceDocs
Financier --> UC_FinanceApprove

Secretaire --> UC_CRM
Secretaire --> UC_Calendar

PM --> UC_ProjectCreate
PM --> UC_TasksAdmin

Collaborateur --> UC_LeaveSubmit
Collaborateur --> UC_TasksUser
Collaborateur --> UC_Chat
Collaborateur --> UC_Calls

Stagiaire --> UC_TasksUser
Stagiaire --> UC_Chat
```

---

## 3. Diagramme de Classes Détaillé (Class Diagram)

Ce diagramme représente la structure complète de la base de données relationnelle et la modélisation des entités sous Prisma.

```mermaid
classDiagram
    class User {
        +String id
        +String email
        +String passwordHash
        +String firstName
        +String lastName
        +String avatarUrl
        +Boolean isActive
        +Boolean isArchived
        +DateTime createdAt
    }

    class Role {
        +String id
        +String name
        +String description
    }

    class EmployeeProfile {
        +String id
        +String employeeCode
        +String phone
        +String jobTitle
        +String status
    }

    class Project {
        +String id
        +String name
        +String description
        +Decimal budget
        +String status
        +DateTime startDate
        +DateTime endDate
    }

    class Task {
        +String id
        +String title
        +String description
        +String status
        +String priority
        +DateTime dueDate
    }

    class Lead {
        +String id
        +String companyName
        +String contactName
        +String status
        +Decimal estimatedValue
    }

    class Client {
        +String id
        +String companyName
        +String industry
        +String taxId
    }

    class Invoice {
        +String id
        +String invoiceNumber
        +Decimal amount
        +String status
        +DateTime dueDate
    }

    class Quote {
        +String id
        +String quoteNumber
        +Decimal amount
        +String status
    }

    class LeaveRequest {
        +String id
        +String type
        +DateTime startDate
        +DateTime endDate
        +String status
    }

    class ChatRoom {
        +String id
        +String name
        +String type
    }

    class Message {
        +String id
        +String content
        +DateTime createdAt
    }

    User "1" --> "1" Role : possède
    User "1" --> "0..1" EmployeeProfile : possède
    User "1" <-- "many" Task : assigné
    Project "1" <-- "many" Task : contient
    Lead "1" --> "0..1" Client : converti en
    Client "1" <-- "many" Invoice : reçoit
    Client "1" <-- "many" Quote : reçoit
    User "1" <-- "many" LeaveRequest : soumet
    ChatRoom "1" <-- "many" Message : contient
    User "1" <-- "many" Message : envoie
```

---

## 4. Diagramme de Séquence : Workflow d'Approbation de Congé

Ce diagramme montre comment une demande de congé soumise par un Collaborateur transite par le backend pour être validée par le Responsable RH.

```mermaid
sequenceDiagram
    autonumber
    actor C as Collaborateur
    participant API as Backend (NestJS)
    participant DB as Base de Données (PostgreSQL)
    actor RH as Responsable RH

    C->>API: Soumettre demande de congé (Type, Dates)
    API->>DB: Créer LeaveRequest (Status: PENDING)
    API->>API: Générer Notification pour le RH
    API-->>C: Confirmer la soumission (Status PENDING affiché sur le Portail)

    Note over RH: Le RH ouvre son tableau de bord / Centre de Décisions
    RH->>API: Approuver la demande (ID de demande)
    API->>DB: Mettre à jour LeaveRequest (Status: APPROVED)
    API->>DB: Déduire le nombre de jours du solde de congés (EmployeeProfile)
    API->>API: Déclencher Notification de confirmation à l'employé
    API-->>RH: Afficher confirmation d'approbation
    API->>C: Notification "Votre congé a été approuvé !" (Temps Réel via Socket.IO)
```

---

## 5. Diagramme de Séquence : cycle de vie d'une Tâche (Kanban Drag & Drop)

Ce diagramme montre la création d'une tâche par le Chef de Projet et sa mise à jour dynamique par glisser-déposer (Drag & Drop) par le Collaborateur.

```mermaid
sequenceDiagram
    autonumber
    actor PM as Chef de Projet
    participant API as Backend (NestJS)
    participant DB as Base de Données
    actor C as Collaborateur

    PM->>API: Créer Tâche (Titre, Projet, Priorité, Assigné à: Collaborateur)
    API->>DB: Enregistrer Task (Status: TODO)
    API-->>PM: Tâche créée avec succès
    API->>C: Tâche visible sur le Kanban du Collaborateur

    Note over C: Le Collaborateur commence la tâche et la glisse dans "En cours"
    C->>C: Glisser-déposer la carte sur la colonne "En cours" (Drag & Drop)
    C->>API: PUT /tasks/:id (Body: { status: 'IN_PROGRESS' })
    API->>DB: Mettre à jour Task (status = 'IN_PROGRESS')
    API-->>C: Confirmer la mise à jour (Bordure s'illumine en vert, Kanban à jour)
```

---

## 6. Diagramme de Séquence : Signalisation d'Appel WebRTC

Le diagramme ci-dessous illustre le protocole complet d'établissement d'un appel audio/vidéo avec Messenger-level Camera Toggle (activation/désactivation dynamique de la caméra en temps réel sans coupure de flux).

```mermaid
sequenceDiagram
    autonumber
    actor A as Appelant (User A)
    participant S as Serveur de Signalisation (Socket.IO)
    actor B as Appelé (User B)

    Note over A,B: User A démarre l'appel en mode Audio ou Vidéo
    A->>A: Capturer le flux local (audio: true, video: true)
    Note over A: Si appel audio, désactive la piste vidéo localement (enabled=false)
    A->>A: Créer la PeerConnection et ajouter les pistes locales
    A->>A: Créer l'offre SDP (Offer)
    A->>S: Émettre 'webrtc_call_offer' (offer, callerId, callerName, isVideo)
    
    S->>B: Acheminer 'webrtc_incoming_call' en direct vers la socket de B
    Note over B: Ringing Overlay s'affiche (animation de vagues de sonnerie)
    
    B->>B: Accepter l'appel
    B->>B: Capturer le flux local (audio: true, video: true)
    Note over B: Si appel audio, désactive la piste vidéo localement (enabled=false)
    B->>B: Créer la PeerConnection, ajouter les pistes et l'offre distante
    B->>B: Générer la réponse SDP (Answer)
    B->>S: Émettre 'webrtc_call_accept' (roomId, callerId, acceptedByName, answer)
    
    S->>A: Acheminer 'webrtc_accept_response' en direct vers la socket de A
    A->>A: Définir la description distante (setRemoteDescription)
    Note over A,B: Appel connecté ! L'audio de pair à pair et le minuteur se lancent.
    
    Note over A,B: Scénario : User A active sa caméra en cours d'appel
    A->>A: Activer la piste vidéo locale (enabled=true)
    A->>S: Émettre 'webrtc_camera_state' (roomId, isCameraOff: false)
    S->>B: Diffuser 'webrtc_remote_camera_state' (isCameraOff: false)
    B->>B: Afficher la balise vidéo distante pour User A (avatar masqué)
```

---

## 7. Lancement Local

### Backend (NestJS)
```bash
# Configuration de la base de données dans backend/.env
# Lancer les serveurs de développement
npm run start:dev
```

### Frontend (React + Vite)
```bash
npm run dev
```
