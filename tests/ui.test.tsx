import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { rooms, parseAmount } from '../src/data/rooms';
describe('bidder community interface', () => {
  it('labels sample content and never displays fabricated live activity', () => {
    render(<App/>); expect(screen.getByRole('heading', { name: /Good work/ })).toBeInTheDocument();
    expect(screen.getByText(/A public sample catalog/)).toBeInTheDocument();
    expect(screen.queryByText(/transaction successful/i)).not.toBeInTheDocument();
  });
  it('filters commissions by discipline', () => {
    render(<App/>); fireEvent.click(screen.getByRole('button', { name: 'Sound & culture' }));
    expect(screen.getByRole('button', { name: 'Give the next wave a voice.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nothing wasted. Everything reimagined.' })).not.toBeInTheDocument();
  });
  it('saves commissions locally and shows the shortlist', () => {
    render(<App/>); fireEvent.click(screen.getByRole('button', { name: 'Save Rádio Futura' }));
    fireEvent.click(screen.getByRole('button', { name: /Saved commissions/ }));
    expect(JSON.parse(localStorage.getItem('roda:saved')!)).toEqual(['radio-futura']);
  });
  it('requires a wallet before deploying from a commission', () => {
    render(<App/>); fireEvent.click(screen.getByRole('button', { name: 'Explore the commission' }));
    expect(screen.getByRole('button', { name: /Deploy my worker/ })).toBeDisabled();
    expect(screen.getByText('STAYS PRIVATE')).toBeInTheDocument();
  });
  it('uses exact decimal arithmetic and rejects invalid amounts', () => {
    expect(parseAmount('2400.01', rooms[0])).toBe(240001n);
    expect(() => parseAmount('2400.001', rooms[0])).toThrow(); expect(() => parseAmount('9000', rooms[0])).toThrow();
  });
});
