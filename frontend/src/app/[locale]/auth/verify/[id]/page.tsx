import Verify from "@/components/auth/verify";

/**
 * Senior Verify Page with Dynamic Route [id]
 * Base URL fixed: Using clean @/ alias.
 */
const VerifyPage = async ({ 
    params 
}: { 
    params: Promise<{ id: string }> 
}) => {
    const { id } = await params;
    
    return (
        <Verify id={id} />
    )
}

export default VerifyPage;