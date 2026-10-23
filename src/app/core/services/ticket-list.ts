import type { Ticket } from './models';
import { ticketHasTopic } from './ticket-topics';

export interface TicketFilters {
  query: string;
  status: string;
  project: string;
  topic: string;
  priority: string;
  assignee: string;
  type: string;
  version: string;
  sprint: string;
}
export const EMPTY_TICKET_FILTERS: TicketFilters = {
  query: '', status: '', project: '', topic: '', priority: '', assignee: '', type: '', version: '', sprint: '',
};

export function filterTickets(tickets: readonly Ticket[], filters: TicketFilters): Ticket[] {
  const query = filters.query.trim().toLocaleLowerCase('es');
  return tickets.filter(ticket =>
    `${ticket.key} ${ticket.title} ${(ticket.topics ?? []).join(' ')}`.toLocaleLowerCase('es').includes(query) &&
    (!filters.status || ticket.status === filters.status) &&
    (!filters.project || ticket.project_id === filters.project) &&
    (!filters.topic || ticketHasTopic(ticket, filters.topic)) &&
    (!filters.priority || ticket.priority === filters.priority) &&
    (!filters.assignee || (filters.assignee === 'unassigned' ? !ticket.assignee : ticket.assignee === filters.assignee)) &&
    (!filters.type || ticket.type === filters.type) &&
    (!filters.version || (filters.version === ':none:' ? !ticket.target_version : ticket.target_version === filters.version)) &&
    (!filters.sprint || (filters.sprint === 'no-sprint' ? !ticket.sprint_id : ticket.sprint_id === filters.sprint)),
  );
}

export function paginateTickets(tickets: readonly Ticket[], requestedPage: number, requestedSize: number) {
  const size = [10, 25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const pages = Math.max(1, Math.ceil(tickets.length / size));
  const page = Math.min(pages, Math.max(1, Math.trunc(requestedPage) || 1));
  const offset = (page - 1) * size;
  return { page, pages, start: tickets.length ? offset + 1 : 0,
    end: Math.min(offset + size, tickets.length), tickets: tickets.slice(offset, offset + size) };
}
