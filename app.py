import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, time
import numpy as np
from io import StringIO

# Set page configuration
st.set_page_config(
    page_title="Electricity Cost Calculator",
    page_icon="⚡",
    layout="wide"
)

def validate_csv_data(df):
    """Validate the uploaded CSV data structure and content."""
    errors = []
    
    if df.empty:
        errors.append("CSV file is empty")
        return errors
    
    if len(df.columns) < 2:
        errors.append("CSV must have at least 2 columns (datetime and kWh)")
        return errors
    
    # Try to identify datetime and usage columns
    datetime_col = None
    usage_col = None
    
    for col in df.columns:
        col_lower = col.lower()
        if any(term in col_lower for term in ['datetime', 'date', 'time', 'timestamp']):
            datetime_col = col
        elif any(term in col_lower for term in ['kwh', 'usage', 'consumption', 'power']):
            usage_col = col
    
    if datetime_col is None:
        # Try first column as datetime
        datetime_col = df.columns[0]
    
    if usage_col is None:
        # Try second column as usage
        usage_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
    
    # Validate datetime column
    try:
        df[datetime_col] = pd.to_datetime(df[datetime_col])
    except Exception as e:
        errors.append(f"Could not parse datetime column '{datetime_col}': {str(e)}")
    
    # Validate usage column
    try:
        df[usage_col] = pd.to_numeric(df[usage_col], errors='coerce')
        if df[usage_col].isna().any():
            errors.append(f"Non-numeric values found in usage column '{usage_col}'")
        if (df[usage_col] < 0).any():
            errors.append(f"Negative values found in usage column '{usage_col}'")
    except Exception as e:
        errors.append(f"Could not parse usage column '{usage_col}': {str(e)}")
    
    return errors, datetime_col, usage_col

def calculate_power_tariffs(df, datetime_col, usage_col, tariffs):
    """Calculate power tariff costs based on peak usage hours."""
    total_tariff_cost = 0
    peak_hours_info = []
    
    for i, tariff in enumerate(tariffs):
        if not tariff['enabled']:
            continue
            
        # Filter data based on month and hour restrictions
        filtered_df = df.copy()
        
        # Month filtering
        if tariff['months']:
            filtered_df = filtered_df[filtered_df[datetime_col].dt.month.isin(tariff['months'])]
        
        # Hour filtering
        if tariff['hours']:
            filtered_df = filtered_df[filtered_df[datetime_col].dt.hour.isin(tariff['hours'])]
        
        if filtered_df.empty:
            continue
        
        # Group by date and find the maximum usage for each day
        daily_peaks = filtered_df.groupby(filtered_df[datetime_col].dt.date)[usage_col].max().reset_index()
        daily_peaks.columns = ['date', 'peak_usage']
        
        # Sort by peak usage and take top N
        top_peaks = daily_peaks.nlargest(tariff['top_n'], 'peak_usage')
        
        # Calculate tariff cost
        tariff_cost = top_peaks['peak_usage'].sum() * tariff['rate']
        total_tariff_cost += tariff_cost
        
        # Store peak hours information for highlighting
        for _, peak in top_peaks.iterrows():
            # Find the actual datetime for this peak
            peak_datetime = filtered_df[
                (filtered_df[datetime_col].dt.date == peak['date']) & 
                (filtered_df[usage_col] == peak['peak_usage'])
            ][datetime_col].iloc[0]
            
            peak_hours_info.append({
                'datetime': peak_datetime,
                'usage': peak['peak_usage'],
                'tariff_name': f"Tariff {i+1}",
                'rate': tariff['rate']
            })
    
    return total_tariff_cost, peak_hours_info

def calculate_vat(amount, vat_rate, prices_include_vat):
    """Calculate VAT amount and net amount."""
    if prices_include_vat:
        # Prices include VAT, so we need to extract the VAT
        vat_multiplier = 1 + (vat_rate / 100)
        net_amount = amount / vat_multiplier
        vat_amount = amount - net_amount
    else:
        # Prices exclude VAT, so we add VAT
        net_amount = amount
        vat_amount = amount * (vat_rate / 100)
    
    return net_amount, vat_amount

def main():
    st.title("⚡ Electricity Cost Calculator")
    st.markdown("Upload your hourly electricity usage CSV file and configure billing parameters to calculate your total electricity cost.")
    
    # File upload section
    st.header("📁 Upload Usage Data")
    uploaded_file = st.file_uploader(
        "Choose a CSV file with hourly electricity usage data",
        type=['csv'],
        help="CSV should contain columns for datetime and kWh usage"
    )
    
    if uploaded_file is not None:
        try:
            # Read CSV file
            stringio = StringIO(uploaded_file.getvalue().decode("utf-8"))
            df = pd.read_csv(stringio)
            
            # Validate data
            validation_result = validate_csv_data(df)
            if len(validation_result) == 3:  # errors, datetime_col, usage_col
                errors, datetime_col, usage_col = validation_result
            else:
                errors = validation_result
                datetime_col = usage_col = None
            
            if errors:
                st.error("CSV Validation Errors:")
                for error in errors:
                    st.error(f"• {error}")
                return
            
            # Display data preview
            st.success(f"✅ CSV loaded successfully! Found {len(df)} hourly records.")
            st.subheader("Data Preview")
            st.dataframe(df.head(10), use_container_width=True)
            
            # Billing parameters section
            st.header("💰 Billing Parameters")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("Basic Costs")
                fixed_cost = st.number_input(
                    "Fixed Monthly Cost (based on main fuse)",
                    min_value=0.0,
                    value=100.0,
                    step=1.0,
                    format="%.2f"
                )
                
                usage_rate = st.number_input(
                    "Usage Cost per kWh",
                    min_value=0.0,
                    value=1.20,
                    step=0.01,
                    format="%.4f"
                )
                
                vat_rate = st.number_input(
                    "VAT Percentage",
                    min_value=0.0,
                    max_value=100.0,
                    value=25.0,
                    step=0.1,
                    format="%.1f"
                )
                
                prices_include_vat = st.checkbox(
                    "Entered prices include VAT",
                    value=False,
                    help="Check this if the prices you entered above already include VAT"
                )
            
            with col2:
                st.subheader("Power Tariffs")
                num_tariffs = st.number_input(
                    "Number of Power Tariffs",
                    min_value=0,
                    max_value=10,
                    value=1,
                    step=1
                )
                
                tariffs = []
                for i in range(num_tariffs):
                    with st.expander(f"Power Tariff {i+1}", expanded=True):
                        enabled = st.checkbox(f"Enable Tariff {i+1}", value=True, key=f"enable_{i}")
                        
                        top_n = st.number_input(
                            f"Top N peak hours",
                            min_value=1,
                            max_value=31,
                            value=3,
                            step=1,
                            key=f"top_n_{i}"
                        )
                        
                        rate = st.number_input(
                            f"Tariff Rate per kWh",
                            min_value=0.0,
                            value=50.0,
                            step=1.0,
                            format="%.2f",
                            key=f"rate_{i}"
                        )
                        
                        # Month restrictions
                        month_options = {
                            "January": 1, "February": 2, "March": 3, "April": 4,
                            "May": 5, "June": 6, "July": 7, "August": 8,
                            "September": 9, "October": 10, "November": 11, "December": 12
                        }
                        
                        selected_months = st.multiselect(
                            f"Applicable Months (leave empty for all year)",
                            options=list(month_options.keys()),
                            key=f"months_{i}"
                        )
                        months = [month_options[month] for month in selected_months] if selected_months else []
                        
                        # Hour restrictions
                        hour_range = st.slider(
                            f"Applicable Hours (24h format)",
                            min_value=0,
                            max_value=23,
                            value=(0, 23),
                            key=f"hours_{i}"
                        )
                        
                        apply_hour_restriction = st.checkbox(
                            f"Apply hour restriction",
                            value=False,
                            key=f"apply_hours_{i}"
                        )
                        
                        hours = list(range(hour_range[0], hour_range[1] + 1)) if apply_hour_restriction else []
                        
                        tariffs.append({
                            'enabled': enabled,
                            'top_n': top_n,
                            'rate': rate,
                            'months': months,
                            'hours': hours
                        })
            
            # Calculate costs
            if st.button("Calculate Electricity Cost", type="primary"):
                with st.spinner("Calculating costs..."):
                    # Basic usage cost
                    total_usage = df[usage_col].sum()
                    usage_cost = total_usage * usage_rate
                    
                    # Power tariff costs
                    tariff_cost, peak_hours_info = calculate_power_tariffs(
                        df, datetime_col, usage_col, tariffs
                    )
                    
                    # Calculate VAT
                    subtotal_before_vat = fixed_cost + usage_cost + tariff_cost
                    net_amount, vat_amount = calculate_vat(subtotal_before_vat, vat_rate, prices_include_vat)
                    
                    if prices_include_vat:
                        # Prices included VAT, so we show the breakdown
                        fixed_net, fixed_vat = calculate_vat(fixed_cost, vat_rate, True)
                        usage_net, usage_vat = calculate_vat(usage_cost, vat_rate, True)
                        tariff_net, tariff_vat = calculate_vat(tariff_cost, vat_rate, True)
                        
                        total_cost = subtotal_before_vat
                        subtotal_net = fixed_net + usage_net + tariff_net
                        total_vat = fixed_vat + usage_vat + tariff_vat
                    else:
                        # Prices exclude VAT
                        fixed_net = fixed_cost
                        usage_net = usage_cost
                        tariff_net = tariff_cost
                        subtotal_net = net_amount
                        total_vat = vat_amount
                        total_cost = net_amount + vat_amount
                
                # Display results
                st.header("📊 Cost Breakdown")
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.subheader("Cost Components (Net)")
                    st.metric("Fixed Monthly Cost", f"€{fixed_net:.2f}")
                    st.metric("Usage Cost", f"€{usage_net:.2f}", 
                             help=f"Total usage: {total_usage:.2f} kWh")
                    st.metric("Power Tariff Cost", f"€{tariff_net:.2f}")
                    st.metric("Subtotal (Net)", f"€{subtotal_net:.2f}")
                    st.metric("VAT ({:.1f}%)".format(vat_rate), f"€{total_vat:.2f}")
                    st.metric("**Total Cost**", f"**€{total_cost:.2f}**")
                
                with col2:
                    st.subheader("Usage Statistics")
                    st.metric("Total Usage", f"{total_usage:.2f} kWh")
                    st.metric("Average Hourly Usage", f"{total_usage/len(df):.3f} kWh")
                    st.metric("Peak Usage", f"{df[usage_col].max():.3f} kWh")
                    st.metric("Number of Records", f"{len(df)}")
                    
                    if peak_hours_info:
                        st.metric("Peak Hours for Tariffs", f"{len(peak_hours_info)}")
                
                # Create usage chart
                st.header("📈 Hourly Usage Chart")
                
                # Prepare data for plotting
                df_plot = df.copy()
                df_plot['is_peak'] = False
                df_plot['tariff_info'] = ''
                
                # Mark peak hours
                for peak in peak_hours_info:
                    mask = df_plot[datetime_col] == peak['datetime']
                    df_plot.loc[mask, 'is_peak'] = True
                    df_plot.loc[mask, 'tariff_info'] = f"{peak['tariff_name']}: €{peak['rate']:.2f}/kWh"
                
                # Create the plot
                fig = go.Figure()
                
                # Regular usage
                regular_usage = df_plot[~df_plot['is_peak']]
                fig.add_trace(go.Scatter(
                    x=regular_usage[datetime_col],
                    y=regular_usage[usage_col],
                    mode='lines',
                    name='Regular Usage',
                    line=dict(color='lightblue', width=1),
                    hovertemplate='<b>%{x}</b><br>Usage: %{y:.3f} kWh<extra></extra>'
                ))
                
                # Peak usage
                peak_usage = df_plot[df_plot['is_peak']]
                if not peak_usage.empty:
                    fig.add_trace(go.Scatter(
                        x=peak_usage[datetime_col],
                        y=peak_usage[usage_col],
                        mode='markers',
                        name='Peak Hours (Tariff)',
                        marker=dict(color='red', size=8, symbol='diamond'),
                        customdata=peak_usage['tariff_info'],
                        hovertemplate='<b>%{x}</b><br>Usage: %{y:.3f} kWh<br>%{customdata}<extra></extra>'
                    ))
                
                fig.update_layout(
                    title='Hourly Electricity Usage',
                    xaxis_title='Date & Time',
                    yaxis_title='Usage (kWh)',
                    hovermode='x unified',
                    showlegend=True,
                    height=500
                )
                
                st.plotly_chart(fig, use_container_width=True)
                
                # Peak hours details
                if peak_hours_info:
                    st.subheader("🔥 Peak Hours Used for Tariff Calculation")
                    peak_df = pd.DataFrame(peak_hours_info)
                    peak_df['cost'] = peak_df['usage'] * peak_df['rate']
                    peak_df = peak_df.sort_values('datetime')
                    
                    st.dataframe(
                        peak_df[['datetime', 'usage', 'tariff_name', 'rate', 'cost']].rename(columns={
                            'datetime': 'Date & Time',
                            'usage': 'Usage (kWh)',
                            'tariff_name': 'Tariff',
                            'rate': 'Rate (€/kWh)',
                            'cost': 'Cost (€)'
                        }),
                        use_container_width=True
                    )
        
        except Exception as e:
            st.error(f"Error processing file: {str(e)}")
            st.error("Please check that your CSV file has the correct format with datetime and kWh columns.")
    
    else:
        st.info("👆 Please upload a CSV file to get started.")
        st.markdown("""
        ### Expected CSV Format:
        Your CSV file should contain at least two columns:
        - **DateTime column**: Date and time in a recognizable format (e.g., '2024-01-01 00:00:00')
        - **Usage column**: Electricity usage in kWh (numeric values)
        
        Example:
        ```
        datetime,usage_kwh
        2024-01-01 00:00:00,1.234
        2024-01-01 01:00:00,1.156
        2024-01-01 02:00:00,0.987
        ...
        ```
        """)

if __name__ == "__main__":
    main()
