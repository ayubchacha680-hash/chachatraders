import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FastModeToggle from '../fast-mode-toggle';

describe('FastModeToggle', () => {
    it('renders the off state as an accessible toggle', () => {
        render(<FastModeToggle is_enabled={false} onToggle={jest.fn()} />);

        const toggle = screen.getByRole('button', { name: 'Fast Mode: OFF' });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(toggle).toHaveTextContent('Fast Mode');
        expect(toggle).toHaveTextContent('OFF');
    });

    it('renders the active green state and handles keyboard-compatible button activation', () => {
        const onToggle = jest.fn();
        render(<FastModeToggle is_enabled onToggle={onToggle} />);

        const toggle = screen.getByRole('button', { name: 'Fast Mode: ON' });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(toggle).toHaveClass('animation__fast-mode-button--active');

        fireEvent.click(toggle);
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});