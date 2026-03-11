# Hackerspace.sh - Component Reference

> **Last Updated**: 2026-03-10  
> Complete reference for all React components, their props, and usage patterns.

---

## Table of Contents

1. [App Shell Components](#1-app-shell-components)
2. [Page Components](#2-page-components)
3. [Client Components](#3-client-components)
4. [UI Components](#4-ui-components)
5. [Component Patterns](#5-component-patterns)

---

## 1. App Shell Components

### `AppSidebar`

**File**: `components/app-sidebar.tsx`

**Purpose**: Main navigation sidebar for the app.

**Props**:
```typescript
interface AppSidebarProps {
  member: SpaceMember & { spaces: Space }
  taskBadge?: number      // Count for tasks badge
  commsBadge?: number     // Count for unread messages
  paymentBadge?: number   // Count for unlinked payments
}
```

**Usage**:
```tsx
<AppSidebar
  member={member}
  taskBadge={5}
  paymentBadge={3}
/>
```

**Features**:
- Renders navigation grouped by section (Workspace, People, Admin)
- Shows badges for tasks and payments
- Displays user info with sign out
- Highlights active route
- Admin section only visible to admin/board roles

**Navigation Structure**:
```
WORKSPACE
├── Dashboard     /dashboard
├── Tasks & Chores /tasks
├── Projects      /projects
├── Ops & Facilities /ops
└── Comms         /comms

PEOPLE
├── Members       /members
├── Payments      /payments
└── Contacts      /contacts

ADMIN (admin/board only)
├── Import / Sync /import
└── Settings      /settings
```

---

### `AppShell`

**File**: `components/app-shell.tsx`

**Purpose**: Wrapper component for app layout (currently unused).

**Status**: Available but not integrated into layout.

---

## 2. Page Components

### Page Structure Pattern

All feature pages follow a consistent Server Component + Client Component pattern:

```
feature/
├── page.tsx           # Server Component (data fetching)
└── feature-client.tsx # Client Component (UI + interactions)
```

### Dashboard Page

**File**: `app/(app)/dashboard/page.tsx`

**Type**: Server Component

**Data Fetched**:
- Member stats (active members count)
- Task stats (open tasks count)
- Payment stats (unlinked payments count)
- Recent tasks (top 5)
- Active projects (in_progress, blocked, review)
- Recent activity (last 6 items)

**Features**:
- 4 stat cards with badges
- Quick chores list with claim buttons
- Active projects with progress bars
- Payment alerts section
- Recent activity feed

---

### Tasks Page

**Files**: 
- `app/(app)/tasks/page.tsx` (Server)
- `app/(app)/tasks/tasks-client.tsx` (Client)

**Client Props**:
```typescript
interface Props {
  tasks: Task[]
  members: { id: string; display_name: string; user_id: string }[]
  currentUserId: string
  spaceId: string
}
```

**Features**:
- Tabbed view (Chores, Ongoing, My Tasks, Done)
- Area filter dropdown
- Create task modal
- Claim/Complete/Delete actions
- Status badges

**State Management**:
- Local state for tasks (optimistic updates)
- Form state for create modal
- Tab and filter state

---

### Projects Page

**Files**:
- `app/(app)/projects/page.tsx` (Server)
- `app/(app)/projects/projects-client.tsx` (Client)

**Client Props**:
```typescript
interface Props {
  projects: Project[]
  spaceId: string
}
```

**Features**:
- 4-column Kanban (Backlog, In Progress, Review, Done)
- Status change via dropdown
- Create project modal
- Delete action
- Progress bars

---

### Members Page

**Files**:
- `app/(app)/members/page.tsx` (Server)
- `app/(app)/members/members-client.tsx` (Client)

**Client Props**:
```typescript
interface Props {
  members: Member[]
  currentRole: string
}
```

**Features**:
- Tabbed view (All, Payment Issues, Pending Approval, Inactive)
- Search and tier filter
- Add member modal (admin/board only)
- Edit member modal
- Approve/Remove actions
- Payment status indicators

---

### Payments Page

**Files**:
- `app/(app)/payments/page.tsx` (Server)
- `app/(app)/payments/payments-client.tsx` (Client)

**Client Props**:
```typescript
interface Props {
  payments: Payment[]
  members: Member[]
  integrations: Integration[]
  currentRole: string
  spaceId: string
}
```

**Features**:
- Platform summary cards (PayPal, Zeffy, Venmo, Cash)
- Transactions table with filtering
- Log cash modal
- Link member modal
- Platform connection status

---

### Comms Page

**Files**:
- `app/(app)/comms/page.tsx` (Server)
- `app/(app)/comms/comms-client.tsx` (Client)

**Client Props**:
```typescript
interface Props {
  member: any
  space: any
  channels: any[]
}
```

**Features**:
- Channel sidebar (General, Areas, Projects)
- Real-time message subscription
- Message input with send
- User avatars and timestamps
- @mention and #channel highlighting

**Real-time**:
```typescript
const subscription = supabase
  .channel(`channel:${selectedChannel.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'comms_messages',
    filter: `channel_id=eq.${selectedChannel.id}`
  }, payload => {
    if (payload.eventType === 'INSERT') {
      setMessages(prev => [...prev, payload.new])
    }
  })
  .subscribe()
```

---

### Contacts Page

**Files**:
- `app/(app)/contacts/page.tsx` (Server)
- `app/(app)/contacts/contacts-client.tsx` (Client)

**Features**:
- Search functionality
- Grouped by type (Vendors, Landlord, Partners)
- Add/Edit contact modals
- Delete with confirmation
- Contact type badges

---

### Ops Page

**File**: `app/(app)/ops/page.tsx` (Server Component)

**Features**:
- Tabbed view (Knowledge Base, Processes, Secrets, Area Leads)
- Search knowledge base
- Pinned/Critical entries section
- Area-based entries
- Area leads sidebar
- Secrets vault (admin/board only)

---

### Settings Page

**Files**:
- `app/(app)/settings/page.tsx` (Server)
- `app/(app)/settings/settings-client.tsx` (Client)

**Client Props**:
```typescript
interface Props {
  space: Space
  isAdmin: boolean
  integrations: Integration[]
  currentRole: string
}
```

**Features**:
- Space settings tab (name, slug, approval settings)
- Roles & permissions info
- Integrations management (PayPal, Zeffy, Venmo, Stripe)
- Webhook secret management

---

### Import Page

**File**: `app/(app)/import/page.tsx` (Server Component)

**Features**:
- Step indicator (Upload, Map, Preview, Import)
- File drop zone
- Column mapping preview
- Database connector form

**Status**: UI only, file processing not implemented.

---

## 3. Client Components

### TaskClaimButton

**File**: `components/task-claim-button.tsx`

**Props**:
```typescript
interface Props {
  taskId: string
  onClaim?: () => void
}
```

**Usage**:
```tsx
<TaskClaimButton taskId={task.id} onClaim={() => refresh()} />
```

---

### ThemeProvider

**File**: `components/theme-provider.tsx`

**Purpose**: Wraps app with next-themes provider.

**Usage** (in layout):
```tsx
<ThemeProvider attribute="class" defaultTheme="dark">
  {children}
</ThemeProvider>
```

---

## 4. UI Components

All shadcn/ui components are available in `components/ui/`. Key components:

### Layout Components
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`
- `Sheet`, `SheetTrigger`, `SheetContent`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Table`, `TableHeader`, `TableRow`, `TableCell`

### Form Components
- `Button` - Primary actions
- `Input` - Text input
- `Textarea` - Multi-line input
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`
- `Checkbox` - Boolean input
- `Switch` - Toggle input
- `Label` - Form labels

### Feedback Components
- `Badge` - Status indicators
- `Alert`, `AlertTitle`, `AlertDescription`
- `Spinner` - Loading indicator
- `Skeleton` - Loading placeholder
- `Toast`, `Toaster` - Notifications

### Navigation Components
- `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`
- `NavigationMenu`

---

## 5. Component Patterns

### Server/Client Split

```typescript
// page.tsx (Server Component)
export default async function FeaturePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('table').select('*')
  
  return <FeatureClient data={data ?? []} />
}

// feature-client.tsx (Client Component)
'use client'

export function FeatureClient({ data }: { data: Item[] }) {
  const [items, setItems] = useState(data)
  // Interactive UI
}
```

### Modal Pattern

```tsx
const [showModal, setShowModal] = useState(false)
const [form, setForm] = useState({ field: '' })
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)
  setError('')
  
  const result = await serverAction(form)
  
  if (result.error) {
    setError(result.error)
    setLoading(false)
    return
  }
  
  // Update local state
  setShowModal(false)
  setForm({ field: '' })
  setLoading(false)
}

return (
  <>
    <button onClick={() => setShowModal(true)}>Open</button>
    
    {showModal && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-lg">
          <form onSubmit={handleSubmit}>
            {/* Form fields */}
            {error && <p className="text-red-500">{error}</p>}
            <button disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>
      </div>
    )}
  </>
)
```

### Optimistic Update Pattern

```tsx
async function handleAction(id: string) {
  // Optimistically update UI
  setItems(prev => prev.map(item => 
    item.id === id ? { ...item, status: 'updated' } : item
  ))
  
  // Call server
  const result = await serverAction(id)
  
  if (result.error) {
    // Revert on error
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'original' } : item
    ))
  }
}
```

### Tab Pattern

```tsx
const [activeTab, setActiveTab] = useState<'tab1' | 'tab2'>('tab1')

const tabData = {
  tab1: items.filter(i => i.type === 'type1'),
  tab2: items.filter(i => i.type === 'type2'),
}

return (
  <>
    <div className="flex gap-4 border-b">
      {(['tab1', 'tab2'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={activeTab === tab ? 'border-b-2 border-primary' : ''}
        >
          {tab} ({tabData[tab].length})
        </button>
      ))}
    </div>
    
    <div>
      {tabData[activeTab].map(item => (
        <div key={item.id}>{/* Render item */}</div>
      ))}
    </div>
  </>
)
```

### Filter Pattern

```tsx
const [search, setSearch] = useState('')
const [filter, setFilter] = useState('')

const filtered = items.filter(item => {
  const matchesSearch = !search || 
    item.name.toLowerCase().includes(search.toLowerCase())
  const matchesFilter = !filter || item.type === filter
  return matchesSearch && matchesFilter
})

return (
  <>
    <input
      type="text"
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="Search..."
    />
    <select value={filter} onChange={e => setFilter(e.target.value)}>
      <option value="">All</option>
      <option value="type1">Type 1</option>
    </select>
    
    {filtered.map(item => (
      <div key={item.id}>{/* Render */}</div>
    ))}
  </>
)
```

---

## 6. Styling Patterns

### Page Header
```tsx
<div className="bg-sidebar px-6 py-3 flex items-center justify-between">
  <h1 className="text-white font-sans text-lg font-semibold">Page Title</h1>
  <button className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded">
    <PlusIcon className="w-3.5 h-3.5" />
    Action
  </button>
</div>
```

### Tab Bar
```tsx
<div className="bg-card border-b border-border px-6 flex gap-6">
  {tabs.map(tab => (
    <button
      key={tab}
      className={`font-sans text-sm py-3 border-b-2 transition ${
        activeTab === tab
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

### Card List
```tsx
<div className="bg-card rounded border border-border divide-y divide-border">
  {items.map(item => (
    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
      {/* Item content */}
    </div>
  ))}
</div>
```

### Status Badge
```tsx
<span className={`font-mono text-[10px] px-2 py-0.5 rounded ${
  status === 'active' ? 'text-primary bg-primary/10' :
  status === 'warning' ? 'text-orange-600 bg-orange-50' :
  'text-muted-foreground bg-muted'
}`}>
  {status.toUpperCase()}
</span>
```

### Monospace Label
```tsx
<p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
  SECTION LABEL
</p>
```
