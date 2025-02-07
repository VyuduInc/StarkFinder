/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@starknet-react/core";
import { 
  NETWORK_CONFIGS, 
  SupportedNetwork, 
  SupportedAsset 
} from '@/lib/layerswap/types';

interface TransactionFormProps {
  onSubmit: (result: any) => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type FormData = {
  token: string;
  amount: string;
  recipient: string;
  protocol: string;
  toToken: string;
  fromNetwork: SupportedNetwork;
  toNetwork: SupportedNetwork;
  asset: SupportedAsset;
  destinationAddress: string;
  refuel: boolean;
};

type ActionType = 'swap' | 'transfer' | 'deposit' | 'withdraw' | 'bridge';

const actionFields: Record<ActionType, (keyof FormData)[]> = {
  swap: ['token', 'amount', 'toToken'],
  transfer: ['token', 'amount', 'recipient'],
  deposit: ['token', 'amount', 'protocol'],
  withdraw: ['protocol', 'token', 'amount'],
  bridge: ['fromNetwork', 'toNetwork', 'asset', 'amount', 'destinationAddress', 'refuel']
};

export const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, onSuccess, onError }) => {
  const [action, setAction] = useState<ActionType | ''>('');
  const [formData, setFormData] = useState<FormData>({
    token: "",
    amount: "",
    recipient: "",
    protocol: "",
    toToken: "",
    fromNetwork: 'starknet',
    toNetwork: 'starknet',
    asset: 'ETH',
    destinationAddress: "",
    refuel: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useAccount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (action === 'bridge') {
        await handleBridge(formData);
        return;
      }

      // Construct prompt based on action type and form data
      let prompt = "";
      switch (action) {
        case "swap":
          prompt = `Swap ${formData.amount} ${formData.token} to ${formData.toToken}`;
          break;
        case "transfer":
          prompt = `Transfer ${formData.amount} ${formData.token} to ${formData.recipient}`;
          break;
        case "deposit":
          prompt = `Deposit ${formData.amount} ${formData.token} into ${formData.protocol}`;
          break;
        case "withdraw":
          prompt = `Withdraw ${formData.amount} ${formData.token} from ${formData.protocol}`;
          break;
        default:
          throw new Error('Invalid action type');
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          address: address || '0x0',
          chainId: '4012',
          messages: [{
            sender: 'user',
            content: prompt,
          }],
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onSubmit(data.result[0]);
      } else {
        throw new Error(data.error || 'Failed to process transaction');
      }
    } catch (error) {
      console.error('Error:', error);
      onError?.(error instanceof Error ? error.message : 'Transaction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const validateBridgeForm = () => {
    if (!formData.fromNetwork) {
      throw new Error('Please select source network');
    }
    if (!formData.toNetwork) {
      throw new Error('Please select destination network');
    }
    if (formData.fromNetwork === formData.toNetwork) {
      throw new Error('Source and destination networks must be different');
    }
    if (!formData.asset) {
      throw new Error('Please select an asset');
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      throw new Error('Please enter a valid amount');
    }
    if (!formData.destinationAddress) {
      throw new Error('Please enter a destination address');
    }
  };

  const handleBridge = async (formData: FormData) => {
    setIsLoading(true);
    try {
      validateBridgeForm();
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'bridge',
          from_network: formData.fromNetwork,
          to_network: formData.toNetwork,
          asset: formData.asset,
          amount: formData.amount,
          destination_address: formData.destinationAddress,
          refuel: formData.refuel
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Bridge failed');
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }

      onSuccess?.();
    } catch (error) {
      console.error('Bridge error:', error);
      onError?.(error instanceof Error ? error.message : 'Bridge failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderBridgeFields = () => {
    const fromNetworkAssets = NETWORK_CONFIGS.find(
      n => n.name === formData.fromNetwork
    )?.assets || [];

    return (
      <>
        <div className="space-y-2">
          <label className="text-sm text-white/80">From Network</label>
          <Select
            value={formData.fromNetwork}
            onValueChange={(value: SupportedNetwork) => 
              setFormData({ ...formData, fromNetwork: value })
            }
          >
            <SelectTrigger className="bg-white/5 border border-white/20 text-white">
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border border-white/20">
              {NETWORK_CONFIGS.map(network => (
                <SelectItem key={network.name} value={network.name}>
                  {network.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/80">To Network</label>
          <Select
            value={formData.toNetwork}
            onValueChange={(value: SupportedNetwork) => 
              setFormData({ ...formData, toNetwork: value })
            }
          >
            <SelectTrigger className="bg-white/5 border border-white/20 text-white">
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border border-white/20">
              {NETWORK_CONFIGS.map(network => (
                <SelectItem key={network.name} value={network.name}>
                  {network.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/80">Asset</label>
          <Select
            value={formData.asset}
            onValueChange={(value: SupportedAsset) => 
              setFormData({ ...formData, asset: value })
            }
          >
            <SelectTrigger className="bg-white/5 border border-white/20 text-white">
              <SelectValue placeholder="Select asset" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border border-white/20">
              {fromNetworkAssets.map(asset => (
                <SelectItem key={asset} value={asset}>
                  {asset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/80">Amount</label>
          <Input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="bg-white/5 border border-white/20 text-white"
            placeholder="Enter amount"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/80">Destination Address</label>
          <Input
            type="text"
            value={formData.destinationAddress}
            onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
            className="bg-white/5 border border-white/20 text-white"
            placeholder="Enter destination address"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.refuel}
            onChange={(e) => setFormData({ ...formData, refuel: e.target.checked })}
            className="bg-white/5 border border-white/20"
          />
          <label className="text-sm text-white/80">Add gas to destination (Refuel)</label>
        </div>
      </>
    );
  };

  const renderFields = () => {
    if (!action) return null;

    if (action === 'bridge') {
      return renderBridgeFields();
    }

    const fields = actionFields[action];
    return fields.map((field) => (
      <div key={field} className="space-y-2">
        <label className="text-sm text-white/80 capitalize">{field}</label>
        <Input
          type={field === 'amount' ? 'number' : 'text'}
          placeholder={`Enter ${field}`}
          value={formData[field]}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          className="bg-white/5 border border-white/20 text-white"
        />
      </div>
    ));
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-gray-900/50 border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Create Transaction</CardTitle>
        <CardDescription className="text-white/60">
          Select an action and fill in the required details
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-white/80">Action</label>
            <Select 
              onValueChange={(value: ActionType) => {
                setAction(value);
                setFormData({
                  token: "",
                  amount: "",
                  recipient: "",
                  protocol: "",
                  toToken: "",
                  fromNetwork: 'starknet',
                  toNetwork: 'starknet',
                  asset: 'ETH',
                  destinationAddress: "",
                  refuel: false
                });
              }}
            >
              <SelectTrigger className="bg-white/5 border border-white/20 text-white">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border border-white/20">
                <SelectItem value="swap">Swap</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdraw">Withdraw</SelectItem>
                <SelectItem value="bridge">Bridge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderFields()}

          {action && (
            <Button 
              type="submit" 
              className="w-full bg-white/10 hover:bg-white/20 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Submit Transaction"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
};