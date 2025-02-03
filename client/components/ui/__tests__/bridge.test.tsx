import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAccount } from '@starknet-react/core';
import Bridge from '../bridge';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('@starknet-react/core', () => ({
  useAccount: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('Bridge Component', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock useAccount hook
    (useAccount as jest.Mock).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    });
  });

  it('should render bridge form', () => {
    render(<Bridge />);

    expect(screen.getByPlaceholderText('Amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bridge/i })).toBeInTheDocument();
  });

  it('should validate minimum bridge amount', async () => {
    render(<Bridge />);

    const amountInput = screen.getByPlaceholderText('Amount');
    fireEvent.change(amountInput, { target: { value: '0.001' } });

    const bridgeButton = screen.getByRole('button', { name: /bridge/i });
    fireEvent.click(bridgeButton);

    await waitFor(() => {
      expect(screen.getByText(/minimum bridge amount/i)).toBeInTheDocument();
    });
  });

  it('should validate maximum bridge amount', async () => {
    render(<Bridge />);

    const amountInput = screen.getByPlaceholderText('Amount');
    fireEvent.change(amountInput, { target: { value: '1001' } });

    const bridgeButton = screen.getByRole('button', { name: /bridge/i });
    fireEvent.click(bridgeButton);

    await waitFor(() => {
      expect(screen.getByText(/maximum bridge amount/i)).toBeInTheDocument();
    });
  });

  it('should show loading state while bridging', async () => {
    render(<Bridge />);

    const amountInput = screen.getByPlaceholderText('Amount');
    fireEvent.change(amountInput, { target: { value: '0.1' } });

    const bridgeButton = screen.getByRole('button', { name: /bridge/i });
    fireEvent.click(bridgeButton);

    expect(screen.getByText(/bridging/i)).toBeInTheDocument();
    expect(bridgeButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText(/bridging/i)).not.toBeInTheDocument();
      expect(bridgeButton).not.toBeDisabled();
    });
  });

  it('should handle bridge errors', async () => {
    render(<Bridge />);

    const amountInput = screen.getByPlaceholderText('Amount');
    fireEvent.change(amountInput, { target: { value: '0.1' } });

    const bridgeButton = screen.getByRole('button', { name: /bridge/i });
    fireEvent.click(bridgeButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
